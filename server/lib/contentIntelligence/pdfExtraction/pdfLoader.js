"use strict";

const zlib = require("zlib");
const { normalizeWhitespace } = require("./normalization");

function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (Buffer.isBuffer(input)) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  throw new TypeError("PDF input must be a Buffer, Uint8Array, or ArrayBuffer.");
}

function decodePdfLiteralString(raw) {
  let output = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== "\\") {
      output += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === "n") {
      output += "\n";
      i += 1;
    } else if (next === "r") {
      output += "\r";
      i += 1;
    } else if (next === "t") {
      output += "\t";
      i += 1;
    } else if (next === "(" || next === ")" || next === "\\") {
      output += next;
      i += 1;
    } else if (/[0-7]/u.test(next)) {
      let oct = next;
      i += 1;
      for (let count = 1; count < 3 && i + 1 < raw.length && /[0-7]/u.test(raw[i + 1]); count += 1) {
        i += 1;
        oct += raw[i];
      }
      output += String.fromCharCode(Number.parseInt(oct, 8));
    } else if (next) {
      output += next;
      i += 1;
    }
  }
  return output;
}

function decodePdfHexString(raw) {
  const hex = raw.replace(/[^0-9A-Fa-f]/gu, "");
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(Number.parseInt(hex.slice(i, i + 2).padEnd(2, "0"), 16));
  }
  return Buffer.from(bytes).toString("latin1");
}

function parsePdfObjects(buffer) {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const text = source.toString("latin1");
  const objects = new Map();
  const objectRe = /(\d+)\s+(\d+)\s+obj\b/g;
  let match = objectRe.exec(text);
  while (match) {
    const objectNumber = Number(match[1]);
    const generation = Number(match[2]);
    const start = match.index + match[0].length;
    const endMarker = text.indexOf("endobj", start);
    if (endMarker === -1) break;
    const body = text.slice(start, endMarker).trim();
    objects.set(`${objectNumber} ${generation}`, { objectNumber, generation, body, raw: body });
    match = objectRe.exec(text);
  }
  return { text, objects, source };
}

function extractStream(body, sourceText) {
  const streamIndex = body.search(/\bstream\b/);
  if (streamIndex === -1) return { dictionary: body, stream: null };
  const dictionary = body.slice(0, streamIndex).trim();
  let dataStart = streamIndex + "stream".length;
  if (body[dataStart] === "\r") dataStart += 1;
  if (body[dataStart] === "\n") dataStart += 1;
  const endstream = body.indexOf("endstream", dataStart);
  if (endstream === -1) return { dictionary, stream: null };
  let stream = Buffer.from(body.slice(dataStart, endstream), "latin1");
  if (stream.length && stream[stream.length - 1] === 0x0a) stream = stream.subarray(0, stream.length - 1);
  if (stream.length && stream[stream.length - 1] === 0x0d) stream = stream.subarray(0, stream.length - 1);

  if (/\/Filter\s*\/FlateDecode/u.test(dictionary) || /\/Filter\s*\[\s*\/FlateDecode\s*\]/u.test(dictionary)) {
    try {
      stream = zlib.inflateSync(stream);
    } catch {
      try {
        stream = zlib.unzipSync(stream);
      } catch {
        // leave compressed bytes untouched; text extraction may be empty
      }
    }
  }
  void sourceText;
  return { dictionary, stream };
}

function dictGet(dictionary, key) {
  const pattern = new RegExp(
    `/${key}\\s*(\\/[A-Za-z0-9_.#+-]+|\\d+\\s+\\d+\\s+R|\\([^)]*\\)|\\[[^\\]]*\\]|<<[\\s\\S]*?>>|[^\\s/\\[\\]<>(]+)`,
    "u"
  );
  const match = String(dictionary || "").match(pattern);
  return match ? match[1].trim() : null;
}

function parseRef(value) {
  const match = String(value || "").match(/^(\d+)\s+(\d+)\s+R$/u);
  if (!match) return null;
  return `${match[1]} ${match[2]}`;
}

function parseArrayRefs(value) {
  if (!value) return [];
  const refs = [];
  const re = /(\d+)\s+(\d+)\s+R/g;
  let match = re.exec(value);
  while (match) {
    refs.push(`${match[1]} ${match[2]}`);
    match = re.exec(value);
  }
  return refs;
}

function getObject(objects, ref) {
  if (!ref) return null;
  return objects.get(ref) || objects.get(ref.replace(/ 0$/u, " 0")) || null;
}

function resolvePages(objects, pagesRef, collector = []) {
  const obj = getObject(objects, pagesRef);
  if (!obj) return collector;
  const { dictionary } = extractStream(obj.body);
  const type = dictGet(dictionary, "Type");
  if (type === "/Page") {
    collector.push({ ref: pagesRef, dictionary });
    return collector;
  }
  const kids = dictGet(dictionary, "Kids") || "";
  for (const kid of parseArrayRefs(kids)) resolvePages(objects, kid, collector);
  return collector;
}

function extractInfo(objects, text) {
  const trailerMatch = text.match(/trailer\s*(<<[\s\S]*?>>)\s*startxref/u);
  const info = {};
  if (!trailerMatch) return info;
  const infoRef = parseRef(dictGet(trailerMatch[1], "Info"));
  const infoObj = getObject(objects, infoRef);
  if (!infoObj) return info;
  for (const key of ["Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "ModDate"]) {
    const literal = infoObj.body.match(new RegExp(`/${key}\\s*\\(([^)]*)\\)`, "u"));
    const hex = infoObj.body.match(new RegExp(`/${key}\\s*<([0-9A-Fa-f]+)>`, "u"));
    if (literal) info[key] = decodePdfLiteralString(literal[1]);
    else if (hex) info[key] = decodePdfHexString(hex[1]);
  }
  return info;
}

function extractTextItemsFromContent(streamBuffer) {
  if (!streamBuffer || !streamBuffer.length) return [];
  const content = streamBuffer.toString("latin1");
  const items = [];
  let x = 0;
  let y = 0;
  let fontHeight = 12;
  let inText = false;

  const tokens = content.match(/(?:\[(?:\\.|[^\]\\])*\]|\((?:\\.|[^)\\])*\)|<[^>]*>|\/[A-Za-z0-9_.#+-]+|-?\d*\.?\d+|[A-Za-z]+)/g) || [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "BT") {
      inText = true;
      continue;
    }
    if (token === "ET") {
      inText = false;
      continue;
    }
    if (!inText) continue;

    if (token === "Tm" && i >= 6) {
      const vals = tokens.slice(i - 6, i).map(Number);
      if (vals.every((value) => Number.isFinite(value))) {
        fontHeight = Math.abs(vals[3] || vals[0] || fontHeight) || fontHeight;
        x = vals[4];
        y = vals[5];
      }
      continue;
    }
    if (token === "Td" && i >= 2) {
      const dx = Number(tokens[i - 2]);
      const dy = Number(tokens[i - 1]);
      if (Number.isFinite(dx) && Number.isFinite(dy)) {
        x += dx;
        y += dy;
      }
      continue;
    }
    if (token === "TD" && i >= 2) {
      const dx = Number(tokens[i - 2]);
      const dy = Number(tokens[i - 1]);
      if (Number.isFinite(dx) && Number.isFinite(dy)) {
        x += dx;
        y += dy;
      }
      continue;
    }
    if ((token === "Tf" || token === "TF") && i >= 2) {
      const size = Number(tokens[i - 1]);
      if (Number.isFinite(size)) fontHeight = Math.abs(size);
      continue;
    }
    if (token === "Tj" && i >= 1) {
      const prev = tokens[i - 1];
      let str = "";
      if (prev.startsWith("(") && prev.endsWith(")")) str = decodePdfLiteralString(prev.slice(1, -1));
      else if (prev.startsWith("<") && prev.endsWith(">")) str = decodePdfHexString(prev.slice(1, -1));
      if (str) {
        items.push({
          str,
          transform: [fontHeight, 0, 0, fontHeight, x, y],
          width: Math.max(str.length * fontHeight * 0.5, fontHeight),
          height: fontHeight,
          hasEOL: false
        });
        x += Math.max(str.length * fontHeight * 0.5, 0);
      }
      continue;
    }
    if (token === "TJ" && i >= 1) {
      const prev = tokens[i - 1];
      if (prev.startsWith("[") && prev.endsWith("]")) {
        const inner = prev.slice(1, -1);
        const parts = inner.match(/\((?:\\.|[^)\\])*\)|<[^>]*>|-?\d*\.?\d+/g) || [];
        let combined = "";
        for (const part of parts) {
          if (part.startsWith("(") && part.endsWith(")")) {
            combined += decodePdfLiteralString(part.slice(1, -1));
          } else if (part.startsWith("<") && part.endsWith(">")) {
            combined += decodePdfHexString(part.slice(1, -1));
          } else {
            const adjust = Number(part);
            if (Number.isFinite(adjust) && adjust < -120) combined += " ";
          }
        }
        if (combined) {
          items.push({
            str: combined,
            transform: [fontHeight, 0, 0, fontHeight, x, y],
            width: Math.max(combined.length * fontHeight * 0.5, fontHeight),
            height: fontHeight,
            hasEOL: false
          });
          x += Math.max(combined.length * fontHeight * 0.5, 0);
        }
      }
    }
  }
  return items;
}

function extractAnnotations(dictionary, objects) {
  const annotsValue = dictGet(dictionary, "Annots");
  if (!annotsValue) return [];
  const refs = parseArrayRefs(annotsValue);
  const annotations = [];
  for (const ref of refs) {
    const obj = getObject(objects, ref);
    if (!obj) continue;
    const body = obj.body;
    const subtypeMatch = body.match(/\/Subtype\s*\/([A-Za-z]+)/u);
    const subtype = subtypeMatch ? subtypeMatch[1] : null;
    const uriMatch = body.match(/\/URI\s*\(([^)]*)\)/u);
    const uri = uriMatch ? decodePdfLiteralString(uriMatch[1]) : null;
    const contentsMatch = body.match(/\/Contents\s*\(([^)]*)\)/u);
    const contents = contentsMatch ? decodePdfLiteralString(contentsMatch[1]) : null;
    annotations.push({
      id: ref,
      subtype,
      url: uri,
      unsafeUrl: uri,
      contents,
      title: contents
    });
  }
  return annotations;
}

function extractImagesFromResources(dictionary, objects, pageNumber) {
  const images = [];
  const xobjectBlock = dictionary.match(/\/XObject\s*<<([^>]*)>>/u);
  if (!xobjectBlock) return images;
  const entries = [...xobjectBlock[1].matchAll(/\/([A-Za-z0-9_.#+-]+)\s+(\d+)\s+(\d+)\s+R/g)];
  for (const entry of entries) {
    const name = entry[1];
    const ref = `${entry[2]} ${entry[3]}`;
    const obj = getObject(objects, ref);
    if (!obj) continue;
    const { dictionary: imageDict } = extractStream(obj.body);
    if (!/\/Subtype\s*\/Image/u.test(imageDict)) continue;
    images.push({
      pageNumber,
      name,
      width: Number(dictGet(imageDict, "Width")) || null,
      height: Number(dictGet(imageDict, "Height")) || null
    });
  }
  return images;
}

function extractAttachments(objects, text) {
  const attachments = [];
  const namesMatch = text.match(/\/EmbeddedFiles\s+(\d+)\s+(\d+)\s+R/u);
  if (!namesMatch) return attachments;
  const namesObj = getObject(objects, `${namesMatch[1]} ${namesMatch[2]}`);
  if (!namesObj) return attachments;
  const namesArrayMatch = namesObj.body.match(/\/Names\s*\[([\s\S]*?)\]/u);
  if (!namesArrayMatch) return attachments;
  const pairs = [...namesArrayMatch[1].matchAll(/\(([^)]*)\)\s+(\d+)\s+(\d+)\s+R/g)];
  for (const pair of pairs) {
    const filename = decodePdfLiteralString(pair[1]);
    const filespec = getObject(objects, `${pair[2]} ${pair[3]}`);
    if (!filespec) continue;
    const descMatch = filespec.body.match(/\/Desc\s*\(([^)]*)\)/u);
    const efMatch = filespec.body.match(/\/EF\s*<<[^>]*\/F\s+(\d+)\s+(\d+)\s+R/u);
    let size = null;
    let contentType = null;
    if (efMatch) {
      const fileObj = getObject(objects, `${efMatch[1]} ${efMatch[2]}`);
      if (fileObj) {
        const { dictionary, stream } = extractStream(fileObj.body);
        size = stream ? stream.length : Number(dictGet(dictionary, "Length")) || null;
        contentType = null;
      }
    }
    attachments.push({
      filename,
      description: descMatch ? decodePdfLiteralString(descMatch[1]) : null,
      contentType,
      size
    });
  }
  return attachments;
}

function mediaBoxHeight(dictionary) {
  const match = dictionary.match(/\/MediaBox\s*\[\s*[^\]]*?([-\d.]+)\s*\]/u);
  if (!match) return 792;
  const values = dictionary.match(/\/MediaBox\s*\[([^\]]+)\]/u);
  if (!values) return 792;
  const nums = values[1].trim().split(/\s+/u).map(Number);
  if (nums.length >= 4 && Number.isFinite(nums[3])) return nums[3] - (nums[1] || 0);
  return 792;
}

/**
 * Deterministic offline PDF open/parse. No network, rendering, OCR, or AI.
 */
async function openPdfDocument(pdfBytes) {
  const data = toUint8Array(pdfBytes);
  if (!data.length) {
    const error = new Error("PDF input is empty.");
    error.code = "EMPTY_PDF";
    throw error;
  }

  const { text, objects } = parsePdfObjects(Buffer.from(data));
  if (!/%PDF-/u.test(text)) {
    const error = new Error("Input is not a PDF document.");
    error.code = "INVALID_PDF";
    throw error;
  }

  const catalogRefMatch = text.match(/\/Root\s+(\d+)\s+(\d+)\s+R/u);
  const catalog = catalogRefMatch
    ? getObject(objects, `${catalogRefMatch[1]} ${catalogRefMatch[2]}`)
    : null;
  const pagesRef = catalog ? parseRef(dictGet(catalog.body, "Pages")) : null;
  const pageObjects = pagesRef ? resolvePages(objects, pagesRef) : [];
  const info = extractInfo(objects, text);
  const attachments = extractAttachments(objects, text);

  const pages = [];
  for (let index = 0; index < pageObjects.length; index += 1) {
    const page = pageObjects[index];
    const pageNumber = index + 1;
    const contentsRef = parseRef(dictGet(page.dictionary, "Contents"));
    let items = [];
    if (contentsRef) {
      const contentObj = getObject(objects, contentsRef);
      if (contentObj) {
        const { stream } = extractStream(contentObj.body);
        items = extractTextItemsFromContent(stream);
      }
    } else {
      const contentRefs = parseArrayRefs(dictGet(page.dictionary, "Contents") || "");
      for (const ref of contentRefs) {
        const contentObj = getObject(objects, ref);
        if (!contentObj) continue;
        const { stream } = extractStream(contentObj.body);
        items = items.concat(extractTextItemsFromContent(stream));
      }
    }

    pages.push({
      pageNumber,
      height: mediaBoxHeight(page.dictionary),
      textContent: { items },
      annotations: extractAnnotations(page.dictionary, objects),
      images: extractImagesFromResources(page.dictionary, objects, pageNumber)
    });
  }

  const versionMatch = text.match(/%PDF-(\d\.\d)/u);
  return {
    pdf: {
      numPages: pages.length,
      pdfInfo: { PDFFormatVersion: versionMatch ? versionMatch[1] : null },
      getMetadata: async () => ({ info, metadata: null }),
      getAttachments: async () => {
        const map = {};
        for (const attachment of attachments) {
          map[attachment.filename] = {
            filename: attachment.filename,
            description: attachment.description,
            contentType: attachment.contentType,
            content: attachment.size != null ? { byteLength: attachment.size } : null,
            length: attachment.size
          };
        }
        return Object.keys(map).length ? map : null;
      },
      getPage: async (pageNumber) => {
        const page = pages[pageNumber - 1];
        if (!page) throw new Error(`Missing page ${pageNumber}`);
        return {
          getViewport: () => ({ height: page.height, width: 612 }),
          getTextContent: async () => page.textContent,
          getAnnotations: async () => page.annotations,
          getOperatorList: async () => ({
            fnArray: page.images.map(() => 85),
            argsArray: page.images.map((image) => [image.name])
          }),
          objs: {
            get: (name) => {
              const image = page.images.find((entry) => entry.name === name);
              return image ? { width: image.width, height: image.height } : null;
            }
          },
          commonObjs: {}
        };
      },
      destroy: async () => {}
    },
    warnings: pages.length ? [] : [normalizeWhitespace("PDF contained no pages.")]
  };
}

module.exports = {
  toUint8Array,
  openPdfDocument,
  decodePdfLiteralString
};
