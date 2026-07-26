"use strict";

/**
 * CIP Stage 3D — deterministic document adapter.
 *
 * Converts any supported input (Stage 3B normalized HTML document, Stage 3C
 * normalized PDF document, or a plain descriptor for unknown documents) into
 * a uniform correlation view. Reuses Stage 1B Metadata Intelligence (which
 * itself reuses Stage 1A Document Classification). Never rewrites content —
 * every view keeps traceable references back to its original input.
 */

const { extractMetadata } = require("../metadataIntelligence");
const { NORMALIZED_HTML_DOCUMENT_FORMAT_ID } = require("../htmlExtraction/htmlExtractionTypes");
const { NORMALIZED_PDF_DOCUMENT_FORMAT_ID } = require("../pdfExtraction/pdfExtractionTypes");
const {
  DOCUMENT_ROLES,
  DOCUMENT_KINDS,
  getDocumentRoleLabel
} = require("./correlationTypes");
const {
  collapseWhitespace,
  identityKey,
  identifierKey,
  urlKey,
  sha256,
  uniqueSorted,
  uniqueOrdered
} = require("./correlationUtils");

/** Ordered: most specific role first so composite titles resolve deterministically. */
const ROLE_PATTERNS = Object.freeze([
  { role: DOCUMENT_ROLES.CORRIGENDUM, pattern: /\b(?:corrigendum|addendum|errata|correction\s+notice)\b/iu },
  { role: DOCUMENT_ROLES.SHORT_NOTICE, pattern: /\bshort\s+notice\b/iu },
  { role: DOCUMENT_ROLES.DETAILED_ADVERTISEMENT, pattern: /\bdetailed\s+(?:advertisement|advt|notification)\b/iu },
  { role: DOCUMENT_ROLES.JOINING_NOTICE, pattern: /\bjoining\s+(?:notice|letter|schedule|instructions?)\b/iu },
  { role: DOCUMENT_ROLES.MERIT_LIST, pattern: /\b(?:merit\s*list|select(?:ion)?\s+list)\b/iu },
  { role: DOCUMENT_ROLES.CUTOFF, pattern: /\bcut[\s-]*off\b/iu },
  { role: DOCUMENT_ROLES.RESPONSE_SHEET, pattern: /\bresponse\s+sheet\b/iu },
  { role: DOCUMENT_ROLES.ANSWER_KEY, pattern: /\banswer\s*key\b/iu },
  { role: DOCUMENT_ROLES.ADMIT_CARD, pattern: /\b(?:admit\s*card|hall\s*ticket|call\s*letter)\b/iu },
  { role: DOCUMENT_ROLES.EXAM_SCHEDULE, pattern: /\bexam(?:ination)?\s+(?:schedule|calendar|programme|program|date\s+notice)\b/iu },
  { role: DOCUMENT_ROLES.RESULT, pattern: /\bresult\b/iu },
  { role: DOCUMENT_ROLES.NOTIFICATION, pattern: /\b(?:notification|recruitment|advertisement|vacanc(?:y|ies)|apply\s+online)\b/iu }
]);

/** Read-only bridge from Stage 1A document types to Stage 3D lifecycle roles. */
const STAGE1A_TYPE_TO_ROLE = Object.freeze({
  new_recruitment: DOCUMENT_ROLES.NOTIFICATION,
  correction_notice: DOCUMENT_ROLES.CORRIGENDUM,
  short_notice: DOCUMENT_ROLES.SHORT_NOTICE,
  admit_card: DOCUMENT_ROLES.ADMIT_CARD,
  answer_key: DOCUMENT_ROLES.ANSWER_KEY,
  result: DOCUMENT_ROLES.RESULT
});

/** Phrases stripped from titles to obtain a role-independent recruitment name. */
const ROLE_PHRASE_STRIP = Object.freeze([
  /\bcorrigendum\b/giu,
  /\baddendum\b/giu,
  /\berrata\b/giu,
  /\bcorrection\s+notice\b/giu,
  /\bshort\s+notice\b/giu,
  /\bdetailed\s+(?:advertisement|advt)\b/giu,
  /\bjoining\s+(?:notice|letter|schedule)\b/giu,
  /\bmerit\s*list\b/giu,
  /\bselect(?:ion)?\s+list\b/giu,
  /\bcut[\s-]*off\b/giu,
  /\bresponse\s+sheet\b/giu,
  /\banswer\s*key\b/giu,
  /\badmit\s*card\b/giu,
  /\bhall\s*ticket\b/giu,
  /\bcall\s*letter\b/giu,
  /\bexam(?:ination)?\s+schedule\b/giu,
  /\bresult\b/giu,
  /\bnotification\b/giu,
  /\badvertisement\b/giu,
  /\bregarding\b/giu,
  /\bnotice\b/giu,
  /\bdownload\b/giu,
  /\bfinal\b/giu,
  /\brevised\b/giu,
  /\bupdated\b/giu
]);

const IDENTIFIER_REFERENCE_PATTERN =
  /(?:advt|advertisement|adv|notification|notice|vacancy)\s*(?:no|number|no\.)?\s*[.:\-]?\s*([A-Za-z0-9][A-Za-z0-9/\-.]{2,29}[A-Za-z0-9])/giu;

const REVISION_MARKER_PATTERNS = Object.freeze([
  /\brevised\b/iu,
  /\bupdated\b/iu,
  /\bversion\s*[:\-]?\s*\d+(?:\.\d+)?\b/iu,
  /\bcorrigendum\s*(?:no\.?|number)?\s*[:\-]?\s*\d+\b/iu
]);

const APPLICATION_FEE_PATTERN =
  /(?:application|examination|exam)?\s*fee[^:\n]{0,40}?[:\-–]?\s*(?:rs\.?|₹|inr)\s*\.?\s*([\d,]+(?:\.\d{1,2})?)/iu;

/** Newline-aware vacancy-count extraction (Stage 1B collapses newlines). */
const TOTAL_POSTS_PATTERN =
  /(?:total\s*(?:posts?|vacanc(?:y|ies))|no\.?\s*of\s*(?:posts?|vacancies)|number\s*of\s*(?:posts?|vacancies))\s*[:\-–]?\s*([\d,]{1,9})/iu;

function isNormalizedHtmlDocument(value) {
  return Boolean(value) && value.formatId === NORMALIZED_HTML_DOCUMENT_FORMAT_ID;
}

function isNormalizedPdfDocument(value) {
  return Boolean(value) && value.formatId === NORMALIZED_PDF_DOCUMENT_FORMAT_ID;
}

function normalizeEntry(entry) {
  if (typeof entry === "string") {
    return { document: null, hints: { text: entry } };
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError("Each correlation input must be a document object or text string.");
  }
  if (isNormalizedHtmlDocument(entry) || isNormalizedPdfDocument(entry)) {
    return { document: entry, hints: {} };
  }
  if (entry.document && typeof entry.document === "object") {
    const { document, ...hints } = entry;
    return { document, hints };
  }
  return { document: null, hints: entry };
}

function blockToText(block) {
  if (!block || typeof block !== "object") return "";
  const parts = [];
  if (typeof block.text === "string") parts.push(block.text);
  if (Array.isArray(block.items)) {
    for (const item of block.items) {
      if (item && typeof item.text === "string") parts.push(item.text);
      if (item && Array.isArray(item.lists)) {
        for (const nested of item.lists) parts.push(blockToText(nested));
      }
    }
  }
  if (Array.isArray(block.rows)) {
    for (const row of block.rows) {
      const cells = Array.isArray(row.cells) ? row.cells : [];
      parts.push(cells.map((cell) => (cell && cell.text) || "").join(" "));
    }
  }
  if (typeof block.caption === "string") parts.push(block.caption);
  return parts.filter(Boolean).join("\n");
}

function collectHeadings(document) {
  const blocks = Array.isArray(document && document.contentBlocks) ? document.contentBlocks : [];
  return blocks
    .filter((block) => block && (block.type === "heading" || block.type === "section_title"))
    .map((block) => collapseWhitespace(block.text))
    .filter(Boolean);
}

function collectBodyText(document, hints) {
  if (document) {
    if (Array.isArray(document.pages) && document.pages.length) {
      return document.pages
        .map((page) => (typeof page.text === "string" ? page.text : ""))
        .filter(Boolean)
        .join("\n\n");
    }
    if (Array.isArray(document.contentBlocks)) {
      return document.contentBlocks.map(blockToText).filter(Boolean).join("\n");
    }
  }
  return String(hints.text || hints.content || "");
}

function collectUrls(document, hints, sourceUrl) {
  const urls = [];
  if (sourceUrl) urls.push(sourceUrl);
  if (document && document.metadata && document.metadata.canonicalUrl) {
    urls.push(document.metadata.canonicalUrl);
  }
  const buckets = [
    document && document.resourceList,
    document && document.navigationReferences,
    document && document.embeddedDocuments,
    hints.referenceUrls
  ];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      if (typeof item === "string") urls.push(item);
      else if (item && typeof item === "object") urls.push(item.url || item.href || null);
    }
  }
  return uniqueOrdered(urls.map((value) => urlKey(value)).filter(Boolean));
}

function resolveKind(document, hints) {
  if (isNormalizedHtmlDocument(document)) return DOCUMENT_KINDS.HTML;
  if (isNormalizedPdfDocument(document)) return DOCUMENT_KINDS.PDF;
  const declared = String(hints.kind || hints.documentFormat || "").toLowerCase();
  if (declared === DOCUMENT_KINDS.HTML || declared === DOCUMENT_KINDS.PDF) return declared;
  return DOCUMENT_KINDS.UNKNOWN;
}

function matchRolePattern(blob) {
  if (!blob) return null;
  for (const entry of ROLE_PATTERNS) {
    const match = blob.match(entry.pattern);
    if (match) return { role: entry.role, matchedPattern: match[0] };
  }
  return null;
}

function resolveRole({ hints, title, filename, sourceUrl, bodyText, stage1aType, stage1aConfidence }) {
  const declared = String(hints.role || hints.documentRole || hints.documentType || "")
    .trim()
    .toLowerCase();
  if (Object.values(DOCUMENT_ROLES).includes(declared)) {
    return { role: declared, roleSource: "input_hint", roleConfidence: "high", matchedPattern: null };
  }
  if (STAGE1A_TYPE_TO_ROLE[declared]) {
    return {
      role: STAGE1A_TYPE_TO_ROLE[declared],
      roleSource: "input_hint",
      roleConfidence: "high",
      matchedPattern: null
    };
  }

  const titleBlob = [title, filename, sourceUrl].filter(Boolean).join("\n").toLowerCase();
  const titleMatch = matchRolePattern(titleBlob);
  if (titleMatch) {
    return {
      role: titleMatch.role,
      roleSource: "title_pattern",
      roleConfidence: "high",
      matchedPattern: titleMatch.matchedPattern
    };
  }

  const bodyMatch = matchRolePattern(String(bodyText || "").slice(0, 4000).toLowerCase());
  if (bodyMatch) {
    return {
      role: bodyMatch.role,
      roleSource: "body_pattern",
      roleConfidence: "medium",
      matchedPattern: bodyMatch.matchedPattern
    };
  }

  if (STAGE1A_TYPE_TO_ROLE[stage1aType]) {
    return {
      role: STAGE1A_TYPE_TO_ROLE[stage1aType],
      roleSource: "stage_1a_classification",
      roleConfidence: stage1aConfidence === "high" ? "high" : "medium",
      matchedPattern: null
    };
  }

  return { role: DOCUMENT_ROLES.UNKNOWN, roleSource: "unresolved", roleConfidence: "none", matchedPattern: null };
}

function buildRecruitmentNameKey(title) {
  let text = collapseWhitespace(title);
  if (!text) return null;
  for (const pattern of ROLE_PHRASE_STRIP) {
    text = text.replace(pattern, " ");
  }
  const key = identityKey(text);
  return key && key.length >= 6 ? key : null;
}

function extractExamName(title, headings, bodyText) {
  const labeled = String(bodyText || "").match(
    /(?:name\s+of\s+(?:the\s+)?exam(?:ination)?|exam(?:ination)?\s+name)\s*[:\-–]\s*([^\n]{3,100})/iu
  );
  if (labeled) return collapseWhitespace(labeled[1]);
  const candidates = [title, ...(headings || []), String(bodyText || "").slice(0, 2000)];
  for (const candidate of candidates) {
    const match = String(candidate || "").match(
      /([A-Za-z][A-Za-z0-9 ()&.,'\-]{2,80}?(?:examination|exam))(?:\s*[,\-–]?\s*(20\d{2}))?/iu
    );
    if (match) {
      const year = match[2] ? ` ${match[2]}` : "";
      return collapseWhitespace(`${match[1]}${year}`);
    }
  }
  return null;
}

function extractReferencedIdentifiers(bodyText) {
  const found = [];
  const text = String(bodyText || "");
  let match;
  IDENTIFIER_REFERENCE_PATTERN.lastIndex = 0;
  while ((match = IDENTIFIER_REFERENCE_PATTERN.exec(text)) !== null) {
    const key = identifierKey(match[1]);
    // Identifier-like tokens must contain at least one digit to avoid plain words.
    if (key && /\d/u.test(key)) found.push(key);
  }
  return uniqueSorted(found);
}

function extractRevisionMarkers(title, bodyText) {
  const blob = [title, String(bodyText || "").slice(0, 4000)].filter(Boolean).join("\n");
  const markers = [];
  for (const pattern of REVISION_MARKER_PATTERNS) {
    const match = blob.match(pattern);
    if (match) markers.push(collapseWhitespace(match[0]).toLowerCase());
  }
  return uniqueSorted(markers);
}

function extractApplicationFee(bodyText) {
  const match = String(bodyText || "").match(APPLICATION_FEE_PATTERN);
  if (!match) return null;
  return match[1].replace(/,/gu, "");
}

function extractTotalPosts(bodyText) {
  const match = String(bodyText || "").match(TOTAL_POSTS_PATTERN);
  if (!match) return null;
  const digits = match[1].replace(/,/gu, "");
  return digits ? Number(digits) : null;
}

/**
 * Build a deterministic correlation view for one input document.
 *
 * @param {*} entry Normalized HTML/PDF document, `{ document, ...hints }`
 *   wrapper, plain descriptor `{ title, text, ... }`, or raw text string.
 * @param {number} index Zero-based position in the input array.
 */
function buildDocumentView(entry, index) {
  const { document, hints } = normalizeEntry(entry);
  const warnings = [];

  const documentMetadata = (document && document.metadata) || {};
  const title =
    collapseWhitespace(
      hints.title || documentMetadata.pageTitle || documentMetadata.title || ""
    ) || null;
  const filename = collapseWhitespace(hints.filename || "") || null;
  const sourceUrl =
    collapseWhitespace(hints.sourceUrl || hints.url || documentMetadata.sourceUrl || "") || null;
  const headings = document ? collectHeadings(document) : [];
  const bodyText = collectBodyText(document, hints);
  const kind = resolveKind(document, hints);

  if (!document) {
    warnings.push("Input is not a Stage 3B/3C normalized document; treated as a plain descriptor.");
  }
  if (!title && !bodyText) {
    warnings.push("Document has no title or body text; correlation evidence is limited.");
  }

  // Stage 1B (which reuses Stage 1A) supplies deterministic metadata evidence.
  const metadataResult = extractMetadata({
    title: title || undefined,
    headings: headings.length ? headings : undefined,
    text: bodyText || undefined,
    filename: filename || undefined,
    url: sourceUrl || undefined,
    metadata: hints.metadata && typeof hints.metadata === "object" ? hints.metadata : undefined
  });
  const normalizedMetadata = metadataResult.normalizedMetadata;
  const classification = metadataResult.extensions.classification || null;

  const roleResolution = resolveRole({
    hints,
    title,
    filename,
    sourceUrl,
    bodyText,
    stage1aType: classification ? classification.documentType : null,
    stage1aConfidence: classification ? classification.confidence : "none"
  });
  if (roleResolution.role === DOCUMENT_ROLES.UNKNOWN) {
    warnings.push("Document lifecycle role could not be determined deterministically.");
  }

  const advertisementNumberKey = identifierKey(normalizedMetadata.advertisementNumber);
  const referencedIdentifiers = extractReferencedIdentifiers(bodyText);
  const officialIdentifiers = uniqueSorted(
    [advertisementNumberKey, ...referencedIdentifiers].filter(Boolean)
  );
  const urls = collectUrls(document, hints, sourceUrl);
  const fingerprint = sha256(`${title || ""}\n${collapseWhitespace(bodyText)}`);
  const examName = extractExamName(title, headings, bodyText);

  return {
    documentId: `doc-${index + 1}`,
    inputIndex: index,
    kind,
    formatId: (document && document.formatId) || null,
    sourceEngineId: (document && document.engineId) || null,
    sourceStageId: (document && document.stageId) || null,
    title,
    filename,
    sourceUrl,
    sourceUrlKey: urlKey(sourceUrl),
    headings,
    bodyText,
    sections: uniqueOrdered(headings.map((heading) => identityKey(heading)).filter(Boolean)),
    fingerprint,
    role: roleResolution.role,
    roleLabel: getDocumentRoleLabel(roleResolution.role),
    roleSource: roleResolution.roleSource,
    roleConfidence: roleResolution.roleConfidence,
    roleMatchedPattern: roleResolution.matchedPattern,
    metadata: normalizedMetadata,
    evidence: {
      organization: normalizedMetadata.organization || normalizedMetadata.recruitmentBoard || null,
      organizationKey: identityKey(
        normalizedMetadata.organization || normalizedMetadata.recruitmentBoard
      ),
      advertisementNumber: normalizedMetadata.advertisementNumber || null,
      advertisementNumberKey,
      recruitmentName: title,
      recruitmentNameKey: buildRecruitmentNameKey(title),
      postName: normalizedMetadata.postName || null,
      postNameKey: identityKey(normalizedMetadata.postName),
      department: normalizedMetadata.department || null,
      departmentKey: identityKey(normalizedMetadata.department),
      examName,
      examNameKey: identityKey(examName),
      referenceUrls: urls,
      referencedIdentifiers,
      officialIdentifiers,
      importantDates: normalizedMetadata.importantDates,
      documentDates: {
        creationDate: documentMetadata.creationDate || null,
        modificationDate: documentMetadata.modificationDate || null
      }
    },
    revisionMarkers: extractRevisionMarkers(title, bodyText),
    applicationFee: extractApplicationFee(bodyText),
    totalPosts: extractTotalPosts(bodyText) ?? normalizedMetadata.totalPosts ?? null,
    warnings
  };
}

function buildDocumentViews(entries) {
  return entries.map((entry, index) => buildDocumentView(entry, index));
}

module.exports = {
  ROLE_PATTERNS,
  STAGE1A_TYPE_TO_ROLE,
  isNormalizedHtmlDocument,
  isNormalizedPdfDocument,
  buildDocumentView,
  buildDocumentViews,
  buildRecruitmentNameKey,
  extractReferencedIdentifiers,
  extractRevisionMarkers,
  extractApplicationFee,
  extractTotalPosts,
  extractExamName
};
