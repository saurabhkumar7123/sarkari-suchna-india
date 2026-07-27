"use strict";

/**
 * Deterministic minimal PDF builder for Stage 3C tests.
 * Produces valid PDF 1.4 buffers without network or third-party writers.
 */

function pdfEscape(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function encodePdfString(text) {
  return `(${pdfEscape(text)})`;
}

function buildPdf(options = {}) {
  const pages = options.pages || [{ lines: options.lines || ["Sample"] }];
  const title = options.title || "";
  const author = options.author || "";
  const subject = options.subject || "";
  const creator = options.creator || "CIP Stage 3C Fixture";
  const producer = options.producer || "CIP Minimal PDF Builder";
  const attachments = options.attachments || [];
  const includeImage = Boolean(options.includeImage);

  /** @type {Buffer[]} */
  const objectBodies = [];

  const addObject = (content) => {
    objectBodies.push(Buffer.isBuffer(content) ? content : Buffer.from(String(content), "latin1"));
    return objectBodies.length;
  };

  const addStreamObject = (dictEntries, streamBuffer) => {
    const dict = `<< ${dictEntries} /Length ${streamBuffer.length} >>`;
    return addObject(
      Buffer.concat([
        Buffer.from(`${dict}\nstream\n`, "latin1"),
        streamBuffer,
        Buffer.from("\nendstream", "latin1")
      ])
    );
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let imageId = null;
  if (includeImage) {
    imageId = addStreamObject(
      "/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8",
      Buffer.from([255, 0, 0])
    );
  }

  const embeddedFileIds = [];
  for (const attachment of attachments) {
    const content = Buffer.from(attachment.content || "attachment-bytes", "utf8");
    const fileId = addStreamObject(
      `/Type /EmbeddedFile /Params << /Size ${content.length} >>`,
      content
    );
    const filespecId = addObject(
      `<< /Type /Filespec /F ${encodePdfString(attachment.filename || "file.bin")} /EF << /F ${fileId} 0 R >> /Desc ${encodePdfString(attachment.description || "")} >>`
    );
    embeddedFileIds.push({ filename: attachment.filename || "file.bin", filespecId });
  }

  const contentIds = [];
  const annotIdsByPage = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const lines = page.lines || [];
    const links = page.links || [];
    const contentParts = ["BT"];
    let y = page.startY || 750;

    for (const line of lines) {
      const text = typeof line === "string" ? line : line.text;
      const fontSize =
        typeof line === "string" ? page.fontSize || 12 : line.fontSize || page.fontSize || 12;
      const x = typeof line === "string" ? page.x || 72 : line.x || page.x || 72;
      const bold = typeof line === "object" && line.bold;
      if (typeof line === "object" && line.y != null) y = line.y;
      contentParts.push(`${bold ? "/FB" : "/F1"} ${fontSize} Tf`);
      contentParts.push(`1 0 0 1 ${x} ${y} Tm ${encodePdfString(text)} Tj`);
      y -= typeof line === "object" && line.gap != null ? line.gap : page.lineGap || 16;
    }

    contentParts.push("ET");
    if (includeImage && pageIndex === 0 && imageId) {
      contentParts.push("q", "40 0 0 40 72 72 cm", "/Im1 Do", "Q");
    }

    const stream = Buffer.from(contentParts.join("\n"), "latin1");
    contentIds.push(addStreamObject("", stream));

    const pageAnnotIds = [];
    for (const link of links) {
      const uri = link.uri || link.url;
      const rect = link.rect || [72, 500, 360, 520];
      const annotId = addObject(
        `<< /Type /Annot /Subtype /Link /Rect [${rect.join(" ")}] /Border [0 0 0] /A << /S /URI /URI ${encodePdfString(uri)} >> >>`
      );
      pageAnnotIds.push(annotId);
    }
    annotIdsByPage.push(pageAnnotIds);
  }

  const pagesId = addObject("<< /Type /Pages /Kids [] /Count 0 >>");
  const realPageIds = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const annots = annotIdsByPage[pageIndex];
    const annotPart = annots.length
      ? ` /Annots [${annots.map((id) => `${id} 0 R`).join(" ")}]`
      : "";
    const imagePart =
      includeImage && pageIndex === 0 && imageId ? ` /XObject << /Im1 ${imageId} 0 R >>` : "";
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentIds[pageIndex]} 0 R /Resources << /Font << /F1 ${fontId} 0 R /FB ${boldFontId} 0 R >>${imagePart} >>${annotPart} >>`
    );
    realPageIds.push(pageId);
  }

  objectBodies[pagesId - 1] = Buffer.from(
    `<< /Type /Pages /Kids [${realPageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${realPageIds.length} >>`,
    "latin1"
  );

  let namesId = null;
  if (embeddedFileIds.length) {
    const namesArray = embeddedFileIds
      .map((entry) => `${encodePdfString(entry.filename)} ${entry.filespecId} 0 R`)
      .join(" ");
    const efTreeId = addObject(`<< /Names [${namesArray}] >>`);
    namesId = addObject(`<< /EmbeddedFiles ${efTreeId} 0 R >>`);
  }

  const catalogExtras = namesId ? ` /Names ${namesId} 0 R` : "";
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R${catalogExtras} >>`);

  const infoParts = [];
  if (title) infoParts.push(`/Title ${encodePdfString(title)}`);
  if (author) infoParts.push(`/Author ${encodePdfString(author)}`);
  if (subject) infoParts.push(`/Subject ${encodePdfString(subject)}`);
  if (creator) infoParts.push(`/Creator ${encodePdfString(creator)}`);
  if (producer) infoParts.push(`/Producer ${encodePdfString(producer)}`);
  const infoId = addObject(`<< ${infoParts.join(" ")} >>`);

  const chunks = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets = [0];
  let size = chunks[0].length;
  for (let i = 0; i < objectBodies.length; i += 1) {
    offsets.push(size);
    const objectChunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`, "latin1"),
      objectBodies[i],
      Buffer.from("\nendobj\n", "latin1")
    ]);
    chunks.push(objectChunk);
    size += objectChunk.length;
  }

  const xrefOffset = size;
  let xref = `xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objectBodies.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objectBodies.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n`;
  xref += `startxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

function notificationPdf() {
  return buildPdf({
    title: "Official Notification",
    subject: "Recruitment Notification",
    pages: [
      {
        lines: [
          { text: "GOVERNMENT OF INDIA", bold: true, fontSize: 14, y: 760 },
          { text: "Recruitment Notification", bold: true, fontSize: 16, y: 730 },
          { text: "Advertisement No. SSC/CR/2026/01 dated 15/07/2026", y: 700 },
          { text: "Applications are invited from eligible candidates for the posts.", y: 670 },
          { text: "Important Dates", bold: true, fontSize: 14, y: 640 },
          { text: "Last date to apply is 31/07/2026. See page 2 for fee details.", y: 610 },
          { text: "Contact helpdesk@ssc.gov.in or 011-24360619 for queries.", y: 580 },
          { text: "Visit https://ssc.nic.in/notification.pdf for updates.", y: 550 },
          { text: "1. Eligibility", y: 510 },
          { text: "2. Vacancies", y: 490 },
          { text: "3. How to Apply", y: 470 }
        ],
        links: [{ uri: "https://ssc.nic.in/notification.pdf", rect: [72, 540, 360, 560] }]
      }
    ]
  });
}

function resultPdf() {
  return buildPdf({
    title: "Result Notice",
    pages: [
      {
        lines: [
          { text: "FINAL RESULT", bold: true, fontSize: 16, y: 740 },
          { text: "Result Notice No. RES/2026/44", y: 710 },
          { text: "Post          Roll No       Marks", y: 670 },
          { text: "Clerk         1001          82", y: 650 },
          { text: "Clerk         1002          79", y: 630 },
          { text: "Published on 20-07-2026", y: 590 }
        ]
      }
    ]
  });
}

function admitCardPdf() {
  return buildPdf({
    title: "Admit Card",
    pages: [
      {
        lines: [
          { text: "ADMIT CARD", bold: true, fontSize: 16, y: 740 },
          { text: "Hall Ticket for Combined Graduate Level Examination", y: 710 },
          { text: "Candidate must carry this admit card to the exam centre.", y: 680 },
          { text: "Exam Date: 12 Aug 2026", y: 650 }
        ]
      }
    ],
    includeImage: true
  });
}

function answerKeyPdf() {
  return buildPdf({
    title: "Answer Key",
    pages: [
      {
        lines: [
          { text: "Provisional Answer Key", bold: true, fontSize: 14, y: 740 },
          { text: "Q1 A", y: 700 },
          { text: "Q2 B", y: 680 },
          { text: "Q3 C", y: 660 },
          { text: "Objections to answer-key@exam.gov.in before 25/07/2026", y: 620 }
        ]
      }
    ]
  });
}

function corrigendumPdf() {
  return buildPdf({
    title: "Corrigendum",
    pages: [
      {
        lines: [
          { text: "CORRIGENDUM", bold: true, fontSize: 16, y: 740 },
          { text: "Corrigendum No. CORR/07/2026 to Notification No. NTF/01/2026", y: 710 },
          { text: "The last date stands extended to 10/08/2026.", y: 680 }
        ]
      }
    ]
  });
}

function noticePdf() {
  return buildPdf({
    title: "Public Notice",
    pages: [
      {
        lines: [
          { text: "NOTICE", bold: true, fontSize: 16, y: 740 },
          { text: "Notice No. PN/22/2026", y: 710 },
          { text: "All candidates are informed that centres remain unchanged.", y: 680 },
          { text: "Helpline: 9876543210", y: 650 }
        ]
      }
    ]
  });
}

function multiPageHeaderFooterPdf() {
  return buildPdf({
    title: "Multi Page Notice",
    pages: [
      {
        lines: [
          { text: "UNION PUBLIC SERVICE COMMISSION", bold: true, fontSize: 12, y: 770 },
          { text: "Detailed Advertisement", bold: true, fontSize: 14, y: 730 },
          { text: "Paragraph one continues across", y: 700 },
          { text: "line wrapping without rewrite.", y: 684 },
          { text: "- Age limit 18 years", y: 650 },
          { text: "- Graduate degree required", y: 630 },
          { text: "Page 1", y: 40 }
        ],
        links: [{ uri: "https://upsc.gov.in/notice.pdf", rect: [72, 500, 300, 520] }]
      },
      {
        lines: [
          { text: "UNION PUBLIC SERVICE COMMISSION", bold: true, fontSize: 12, y: 770 },
          { text: "Selection Process", bold: true, fontSize: 14, y: 730 },
          { text: "Duplicate body text sample.", y: 700 },
          { text: "Duplicate body text sample.", y: 680 },
          { text: "Refer page 1 for eligibility.", y: 650 },
          { text: "Page 2", y: 40 }
        ]
      },
      {
        lines: [
          { text: "UNION PUBLIC SERVICE COMMISSION", bold: true, fontSize: 12, y: 770 },
          { text: "General Instructions", bold: true, fontSize: 14, y: 730 },
          { text: "Follow instructions carefully.", y: 700 },
          { text: "Page 3", y: 40 }
        ]
      }
    ],
    attachments: [
      {
        filename: "supporting-note.txt",
        description: "Supporting note",
        content: "metadata only attachment"
      }
    ]
  });
}

function unknownPdf() {
  return buildPdf({
    pages: [{ lines: [{ text: "Unclassified document body", y: 720 }] }]
  });
}

module.exports = {
  buildPdf,
  notificationPdf,
  resultPdf,
  admitCardPdf,
  answerKeyPdf,
  corrigendumPdf,
  noticePdf,
  multiPageHeaderFooterPdf,
  unknownPdf
};
