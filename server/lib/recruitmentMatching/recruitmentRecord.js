"use strict";

/**
 * Phase AI-3 — Recruitment metadata normalization and indexing.
 *
 * Existing recruitment metadata reaches this phase in whatever shape the
 * caller already stores it in. This module reads it defensively through the
 * same field aliases the Production Workflow's deterministic matcher accepts,
 * and never writes back: records are read-only inputs.
 */

const { collapse, round2, toText, uniqueBy } = require("../noticeIntelligence/textUtils");
const {
  coreTokens,
  distinctiveTokens,
  extractYear,
  foldIdentifier,
  toMatchKey
} = require("./matchingUtils");
const { RECRUITMENT_CATEGORIES, RELATIONSHIP_ORDER, UPDATE_RELATIONSHIPS } = require("./types");

/**
 * @param {...*} values
 * @returns {string|null}
 */
function pickString(...values) {
  for (const value of values) {
    const text = collapse(value);
    if (text) return text;
  }
  return null;
}

/**
 * @param {*} value
 * @returns {Array<string>}
 */
function toStringArray(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return uniqueBy(
    list.map((item) => collapse(item)).filter(Boolean),
    (item) => item.toLowerCase()
  );
}

/** Board-code prefixes that imply a recruitment category. */
const CATEGORY_BY_BOARD_CODE = Object.freeze({
  UPSC: RECRUITMENT_CATEGORIES.UNION_PSC,
  UPPSC: RECRUITMENT_CATEGORIES.STATE_PSC,
  BPSC: RECRUITMENT_CATEGORIES.STATE_PSC,
  MPPSC: RECRUITMENT_CATEGORIES.STATE_PSC,
  RPSC: RECRUITMENT_CATEGORIES.STATE_PSC,
  HPSC: RECRUITMENT_CATEGORIES.STATE_PSC,
  JPSC: RECRUITMENT_CATEGORIES.STATE_PSC,
  SSC: RECRUITMENT_CATEGORIES.SSC,
  UPSSSC: RECRUITMENT_CATEGORIES.SUBORDINATE_SERVICE,
  BSSC: RECRUITMENT_CATEGORIES.SUBORDINATE_SERVICE,
  DSSSB: RECRUITMENT_CATEGORIES.SUBORDINATE_SERVICE,
  RRB: RECRUITMENT_CATEGORIES.RAILWAY,
  RRC: RECRUITMENT_CATEGORIES.RAILWAY,
  UPPRPB: RECRUITMENT_CATEGORIES.POLICE,
  BPSSC: RECRUITMENT_CATEGORIES.POLICE,
  IBPS: RECRUITMENT_CATEGORIES.BANKING,
  SBI: RECRUITMENT_CATEGORIES.BANKING,
  RBI: RECRUITMENT_CATEGORIES.BANKING,
  AIIMS: RECRUITMENT_CATEGORIES.MEDICAL,
  ESIC: RECRUITMENT_CATEGORIES.MEDICAL,
  BHU: RECRUITMENT_CATEGORIES.UNIVERSITY,
  DU: RECRUITMENT_CATEGORIES.UNIVERSITY,
  NTA: RECRUITMENT_CATEGORIES.OTHER
});

/** Title vocabulary that implies a category when the board code does not. */
const CATEGORY_BY_TOKEN = Object.freeze({
  police: RECRUITMENT_CATEGORIES.POLICE,
  constable: RECRUITMENT_CATEGORIES.POLICE,
  "sub-inspector": RECRUITMENT_CATEGORIES.POLICE,
  army: RECRUITMENT_CATEGORIES.DEFENCE,
  navy: RECRUITMENT_CATEGORIES.DEFENCE,
  airforce: RECRUITMENT_CATEGORIES.DEFENCE,
  teacher: RECRUITMENT_CATEGORIES.TEACHING,
  lecturer: RECRUITMENT_CATEGORIES.TEACHING,
  professor: RECRUITMENT_CATEGORIES.UNIVERSITY,
  nursing: RECRUITMENT_CATEGORIES.MEDICAL,
  nurse: RECRUITMENT_CATEGORIES.MEDICAL,
  doctor: RECRUITMENT_CATEGORIES.MEDICAL,
  apprentice: RECRUITMENT_CATEGORIES.APPRENTICE,
  railway: RECRUITMENT_CATEGORIES.RAILWAY,
  technician: RECRUITMENT_CATEGORIES.RAILWAY,
  bank: RECRUITMENT_CATEGORIES.BANKING,
  clerk: RECRUITMENT_CATEGORIES.SUBORDINATE_SERVICE
});

/**
 * Infer a recruitment category from the board and title vocabulary.
 *
 * @param {{ category?: string, boardCode?: string, board?: string, title?: string, postNames?: string[] }} input
 * @returns {{ category: string, source: string }}
 */
function inferCategory(input = {}) {
  const declared = toMatchKey(input.category).replace(/\s+/g, "_");
  if (declared && Object.values(RECRUITMENT_CATEGORIES).includes(declared)) {
    return { category: declared, source: "declared" };
  }

  const code = collapse(input.boardCode).toUpperCase();
  if (code && CATEGORY_BY_BOARD_CODE[code]) {
    return { category: CATEGORY_BY_BOARD_CODE[code], source: "board_code" };
  }

  const tokens = coreTokens(`${toText(input.title)} ${toStringArray(input.postNames).join(" ")}`);
  for (const token of tokens) {
    if (CATEGORY_BY_TOKEN[token]) return { category: CATEGORY_BY_TOKEN[token], source: "title_token" };
  }

  // A record may spell the body out in full and omit its code.
  for (const token of coreTokens(toText(input.board))) {
    if (CATEGORY_BY_TOKEN[token]) return { category: CATEGORY_BY_TOKEN[token], source: "board_name" };
  }

  return { category: RECRUITMENT_CATEGORIES.UNKNOWN, source: "none" };
}

/**
 * Highest lifecycle position a recruitment is known to have reached.
 *
 * @param {string[]} relationships
 * @param {string|null} declaredStage
 * @returns {{ stage: string, order: number, source: string }}
 */
function resolveLifecycleStage(relationships, declaredStage) {
  const declared = toMatchKey(declaredStage).replace(/\s+/g, "_");
  const known = Object.values(UPDATE_RELATIONSHIPS);
  let stage = known.includes(declared) ? declared : null;
  let source = stage ? "declared" : "none";

  for (const relationship of relationships || []) {
    if (!known.includes(relationship)) continue;
    if (!stage || RELATIONSHIP_ORDER[relationship] > RELATIONSHIP_ORDER[stage]) {
      stage = relationship;
      source = source === "declared" ? "declared_and_history" : "history";
    }
  }

  if (!stage) return { stage: UPDATE_RELATIONSHIPS.UNKNOWN, order: 0, source: "none" };
  return { stage, order: RELATIONSHIP_ORDER[stage] || 0, source };
}

/**
 * Read the documents already recorded against a recruitment, so a re-posted
 * notice can be recognised as a duplicate rather than as a new update.
 *
 * @param {object} record
 * @returns {Array<{ relationship: string|null, fingerprint: string|null, identifier: string, publicationDate: string|null, title: string|null }>}
 */
function extractRecordedDocuments(record = {}) {
  const source =
    record.documents || record.events || record.recordedEvents || record.timeline || [];
  if (!Array.isArray(source)) return [];
  return source
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const relationship = toMatchKey(
        entry.relationship || entry.updateType || entry.eventType || entry.type
      ).replace(/\s+/g, "_");
      return {
        relationship: relationship || null,
        fingerprint: collapse(entry.fingerprint) || null,
        identifier: foldIdentifier(
          entry.advertisementNumber || entry.referenceNumber || entry.identifier
        ),
        publicationDate: collapse(entry.publicationDate || entry.date) || null,
        title: collapse(entry.title) || null
      };
    })
    .filter(Boolean);
}

/**
 * Normalize one existing recruitment metadata record into the canonical shape
 * the matching engine compares against.
 *
 * @param {object} record raw recruitment metadata
 * @param {number} [position] index in the source collection, used for a stable id
 * @returns {object|null} canonical record, or null when unusable
 */
function normalizeRecruitmentRecord(record, position = 0) {
  if (!record || typeof record !== "object") return null;

  const recruitmentId =
    pickString(record.recruitmentId, record.id, record.recruitment_id, record.key) ||
    `recruitment_${position}`;
  const title = pickString(
    record.normalizedTitle,
    record.recruitmentName,
    record.title,
    record.name,
    record.examName
  );
  const board = pickString(record.board, record.organization, record.org, record.authority);
  const department = pickString(record.department, record.dept, record.ministry, board);
  const boardCode = pickString(record.boardCode, record.departmentCode, record.orgCode, record.code);

  const advertisementNumber = pickString(
    record.advertisementNumber,
    record.advertisementNo,
    record.advtNo,
    record.advt_no,
    record.notificationNumber
  );
  const referenceNumber = pickString(
    record.referenceNumber,
    record.referenceNo,
    record.notificationNumber,
    record.noticeNumber
  );
  const officialIdentifiers = toStringArray(record.officialIdentifiers || record.identifiers);

  const postNames = toStringArray(record.postNames || record.posts || record.postName || record.post);
  const keywords = toStringArray(record.keywords || record.tags);
  const recordedDocuments = extractRecordedDocuments(record);
  const recordedRelationships = uniqueBy(
    [
      ...toStringArray(record.recordedRelationships || record.updates || record.stages).map((value) =>
        toMatchKey(value).replace(/\s+/g, "_")
      ),
      ...recordedDocuments.map((document) => document.relationship).filter(Boolean)
    ],
    (value) => value
  );

  const year =
    extractYear(record.year || record.recruitmentYear || record.cycleYear) ||
    extractYear(advertisementNumber) ||
    extractYear(title);

  const categoryInfo = inferCategory({
    category: record.category || record.recruitmentCategory,
    boardCode,
    board,
    title,
    postNames
  });

  const lifecycle = resolveLifecycleStage(
    recordedRelationships,
    record.lifecycleStage || record.stage || record.currentStage
  );

  const titleTokens = coreTokens(`${toText(title)} ${postNames.join(" ")}`);
  const identifierKeys = uniqueBy(
    [advertisementNumber, referenceNumber, ...officialIdentifiers, record.recruitmentKey]
      .map((value) => foldIdentifier(value))
      .filter(Boolean),
    (value) => value
  );

  return {
    recruitmentId,
    recruitmentKey: pickString(record.recruitmentKey) || null,
    title,
    board,
    boardCode: boardCode ? boardCode.toUpperCase() : null,
    department,
    advertisementNumber,
    referenceNumber,
    officialIdentifiers,
    year,
    category: categoryInfo.category,
    categorySource: categoryInfo.source,
    keywords,
    postNames,
    lifecycleStage: lifecycle.stage,
    lifecycleOrder: lifecycle.order,
    lifecycleSource: lifecycle.source,
    recordedRelationships,
    recordedDocuments,
    fingerprints: toStringArray(record.fingerprints || record.fingerprint),
    publicationDate: pickString(record.publicationDate, record.publishedAt, record.noticeDate),
    status: pickString(record.status) || null,
    sourceUrl: pickString(record.sourceUrl, record.url) || null,
    pageId: pickString(record.pageId) || null,

    // Derived comparison keys.
    advertisementKey: foldIdentifier(advertisementNumber),
    referenceKey: foldIdentifier(referenceNumber),
    identifierKeys,
    boardKey: toMatchKey(boardCode || board),
    departmentKey: toMatchKey(department),
    titleTokens,
    distinctiveTitleTokens: distinctiveTokens(titleTokens),
    keywordKeys: keywords.map((keyword) => toMatchKey(keyword)).filter(Boolean)
  };
}

/**
 * Normalize a collection of recruitment records.
 * @param {Array<object>} records
 * @returns {Array<object>}
 */
function normalizeRecruitmentRecords(records) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record, position) => normalizeRecruitmentRecord(record, position))
    .filter(Boolean);
}

/**
 * @param {Map<string, Array<object>>} map
 * @param {string} key
 * @param {object} value
 */
function pushToMap(map, key, value) {
  if (!key) return;
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

/**
 * Build the lookup structures the candidate search blocks on.
 *
 * @param {Array<object>} records raw or already-normalized recruitment metadata
 * @returns {{
 *   records: Array<object>,
 *   size: number,
 *   byIdentifier: Map<string, Array<object>>,
 *   byBoard: Map<string, Array<object>>,
 *   byToken: Map<string, Array<object>>,
 *   byKeyword: Map<string, Array<object>>,
 *   byCategory: Map<string, Array<object>>,
 *   byId: Map<string, object>,
 *   isIndex: true
 * }}
 */
function buildRecruitmentIndex(records) {
  const normalized = Array.isArray(records) && records.length && records[0] && records[0].identifierKeys
    ? records
    : normalizeRecruitmentRecords(records);

  const byIdentifier = new Map();
  const byBoard = new Map();
  const byToken = new Map();
  const byKeyword = new Map();
  const byCategory = new Map();
  const byId = new Map();

  for (const record of normalized) {
    byId.set(record.recruitmentId, record);
    for (const key of record.identifierKeys) pushToMap(byIdentifier, key, record);
    pushToMap(byBoard, record.boardKey, record);
    if (record.departmentKey && record.departmentKey !== record.boardKey) {
      pushToMap(byBoard, record.departmentKey, record);
    }
    for (const token of record.titleTokens) pushToMap(byToken, token, record);
    for (const keyword of record.keywordKeys) pushToMap(byKeyword, keyword, record);
    pushToMap(byCategory, record.category, record);
  }

  return {
    records: normalized,
    size: normalized.length,
    byIdentifier,
    byBoard,
    byToken,
    byKeyword,
    byCategory,
    byId,
    isIndex: true
  };
}

/**
 * Read the comparable identity out of a Phase AI-2 normalized event.
 *
 * @param {object} normalizedEvent
 * @returns {object} identity in the same shape a normalized record exposes
 */
function buildEventIdentity(normalizedEvent = {}) {
  const event = normalizedEvent && typeof normalizedEvent === "object" ? normalizedEvent : {};
  const hints = (event.recruitmentCandidate && event.recruitmentCandidate.matchHints) || {};

  const title = pickString(event.normalizedTitle, event.sourceTitle);
  const board = pickString(event.sourceBoard, event.sourceDepartment, event.detectedOrganizationText);
  const department = pickString(event.sourceDepartment, event.sourceBoard);
  const boardCode = pickString(event.boardCode, event.departmentCode, hints.departmentCode);
  const advertisementNumber = pickString(event.advertisementNumber, hints.advertisementNumber);
  const referenceNumber = pickString(event.referenceNumber, hints.referenceNumber);
  const postNames = toStringArray(hints.postTitles);
  const keywords = toStringArray(event.keywords);
  const year = extractYear(event.year || hints.year) || extractYear(title);

  const categoryInfo = inferCategory({ boardCode, title, postNames });
  const titleTokens = coreTokens(`${toText(title)} ${postNames.join(" ")}`);

  return {
    title,
    board,
    boardCode: boardCode ? boardCode.toUpperCase() : null,
    department,
    advertisementNumber,
    referenceNumber,
    year,
    category: categoryInfo.category,
    categorySource: categoryInfo.source,
    keywords,
    postNames,
    publicationDate: pickString(event.publicationDate),
    eventType: event.eventType || null,
    eventSubType: event.eventSubType || null,
    lifecycleStage: event.lifecycleStage || null,
    eventConfidence: round2(Number(event.confidence) || 0),
    isRecruitmentCandidate: Boolean(
      event.recruitmentCandidate && event.recruitmentCandidate.isRecruitmentCandidate
    ),
    fingerprint: (event.fingerprint && event.fingerprint.fingerprint) || null,
    fingerprintVariants: (event.fingerprint && event.fingerprint.variants) || {},
    language: event.language || null,

    advertisementKey: foldIdentifier(advertisementNumber),
    referenceKey: foldIdentifier(referenceNumber),
    boardKey: toMatchKey(boardCode || board),
    departmentKey: toMatchKey(department),
    titleTokens,
    distinctiveTitleTokens: distinctiveTokens(titleTokens),
    keywordKeys: keywords.map((keyword) => toMatchKey(keyword)).filter(Boolean)
  };
}

module.exports = {
  CATEGORY_BY_BOARD_CODE,
  CATEGORY_BY_TOKEN,
  pickString,
  toStringArray,
  inferCategory,
  resolveLifecycleStage,
  extractRecordedDocuments,
  normalizeRecruitmentRecord,
  normalizeRecruitmentRecords,
  buildRecruitmentIndex,
  buildEventIdentity
};
