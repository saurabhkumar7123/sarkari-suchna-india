'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-3
 * Extraction Parsers (HTML / RSS / XML / PDF interface)
 *
 * Deterministic, configuration-driven field extraction.
 * No external HTML/PDF libraries. PDF is interface-only when unavailable.
 */

const { deepFreeze } = require('../governmentSourceRegistry');
const { CONTENT_TYPES } = require('../monitoringConfiguration');

const EXTRACTION_PARSERS_VERSION = 'MB3.1.0.0';

const PARSER_CAPABILITIES = Object.freeze({
  HTML: 'HTML',
  RSS: 'RSS',
  XML: 'XML',
  PDF: 'PDF',
});

function bodyToText(body) {
  if (body == null) return '';
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  return String(body);
}

function decodeBasicEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function stripTags(html) {
  return decodeBasicEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|tr|li|h[1-6]|br)\s*>/gi, '\n')
      .replace(/<(br|hr)\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
  );
}

function firstMatch(text, patterns) {
  for (let i = 0; i < patterns.length; i += 1) {
    const match = text.match(patterns[i]);
    if (match && match[1]) {
      return decodeBasicEntities(match[1]);
    }
  }
  return null;
}

function collectMatches(text, pattern) {
  const out = [];
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let match = re.exec(text);
  while (match) {
    if (match[1]) out.push(decodeBasicEntities(match[1]));
    match = re.exec(text);
  }
  return out;
}

function extractTitle(html, plain) {
  return (
    firstMatch(html, [
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    ]) ||
    firstMatch(plain, [
      /(?:recruitment|notification|advertisement|vacancy)\s*[:\-–]\s*([^\n.]{8,120})/i,
    ])
  );
}

const NEXT_FIELD_BOUNDARY =
  '(?=\\n|$|\\s+(?:Advertisement|Advt\\.?|Notification|Department|Ministry|Organisation|Organization|Commission|Board|Qualification|Educational|Eligibility|Age\\s*Limit|Age|No\\.\\s*of|Total\\s*(?:Posts|Vacancies)|Vacancies?|Posts?|Category|Recruitment\\s*Type|Exam\\s*Type|Mode\\s*of|Application\\s*Mode|How\\s*to\\s*Apply|Last\\s*Date|Closing\\s*Date|Published|Issue\\s*Date)\\b)';

function extractFieldNearLabel(plain, labels) {
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    const re = new RegExp(
      `${label}\\s*[:\\-–]?\\s*([^\\n|;]{1,80}?)${NEXT_FIELD_BOUNDARY}`,
      'i'
    );
    const match = plain.match(re);
    if (match && match[1]) {
      return decodeBasicEntities(match[1]).replace(/\s{2,}/g, ' ').trim();
    }
  }
  return null;
}

function extractDateNearLabel(plain, labels) {
  const value = extractFieldNearLabel(plain, labels);
  if (!value) return null;
  const isoish = value.match(
    /(\d{4}-\d{2}-\d{2})|(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/
  );
  return isoish ? isoish[0] : value;
}

function extractAttachments(html) {
  const hrefs = collectMatches(
    html,
    /href=["']([^"']+\.(?:pdf|docx?|xlsx?)(?:\?[^"']*)?)["']/i
  );
  const seen = new Set();
  const attachments = [];
  for (let i = 0; i < hrefs.length; i += 1) {
    const url = hrefs[i];
    if (seen.has(url)) continue;
    seen.add(url);
    attachments.push({
      attachmentId: `ATT_${attachments.length + 1}`,
      url,
      label: null,
      contentType: /\.pdf/i.test(url) ? 'application/pdf' : null,
    });
  }
  return attachments;
}

function detectDuplicateSections(html) {
  const headings = collectMatches(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i).map(
    (h) => h.toLowerCase()
  );
  const seen = new Set();
  const duplicates = [];
  for (let i = 0; i < headings.length; i += 1) {
    if (seen.has(headings[i])) {
      duplicates.push(headings[i]);
    } else {
      seen.add(headings[i]);
    }
  }
  return duplicates;
}

function detectAmbiguousFields(fields) {
  const ambiguous = [];
  if (fields.advertisementNumber && /[,;/|].*\d/.test(fields.advertisementNumber)) {
    ambiguous.push('advertisementNumber');
  }
  if (fields.lastDate && /(?:or|\/|to)\s+/i.test(fields.lastDate)) {
    ambiguous.push('lastDate');
  }
  if (fields.vacancyCount == null && fields.qualification && /\d+\s*(?:post|vacanc)/i.test(fields.qualification)) {
    ambiguous.push('vacancyCount');
  }
  return ambiguous;
}

/**
 * Extract recruitment fields from HTML.
 * @param {object} input
 */
function extractFromHtml(input = {}) {
  const html = bodyToText(input.body);
  const plain = stripTags(html);
  const title = extractTitle(html, plain);
  const advertisementNumber = extractFieldNearLabel(plain, [
    'Advertisement\\s*(?:No\\.?|Number|Num)',
    'Advt\\.\\s*No\\.?',
    'Notification\\s*(?:No\\.?|Number)',
    'Exam\\s*(?:No\\.?|Code)',
  ]);
  const department = extractFieldNearLabel(plain, [
    'Department',
    'Ministry',
    'Organisation',
    'Organization',
  ]);
  const organization = extractFieldNearLabel(plain, [
    'Organization',
    'Organisation',
    'Commission',
    'Board',
  ]);
  const qualification = extractFieldNearLabel(plain, [
    'Qualification',
    'Educational\\s*Qualification',
    'Eligibility',
  ]);
  const age = extractFieldNearLabel(plain, [
    'Age\\s*Limit',
    'Age',
    'Maximum\\s*Age',
  ]);
  const vacancyRaw = extractFieldNearLabel(plain, [
    'No\\.\\s*of\\s*(?:Posts|Vacancies)',
    'Total\\s*(?:Posts|Vacancies)',
    'Vacancies?',
    'Posts?',
  ]);
  const vacancyCount = vacancyRaw
    ? Number(String(vacancyRaw).replace(/[^\d]/g, ''))
    : null;
  const category = extractFieldNearLabel(plain, [
    'Category',
    'Recruitment\\s*Type',
    'Exam\\s*Type',
  ]);
  const applicationMode = extractFieldNearLabel(plain, [
    'Mode\\s*of\\s*Application',
    'Application\\s*Mode',
    'How\\s*to\\s*Apply',
  ]);
  const notificationDate = extractDateNearLabel(plain, [
    'Notification\\s*Date',
    'Date\\s*of\\s*Notification',
    'Published\\s*(?:on|Date)',
    'Issue\\s*Date',
  ]);
  const lastDate = extractDateNearLabel(plain, [
    'Last\\s*Date',
    'Closing\\s*Date',
    'Last\\s*Date\\s*(?:to|for)\\s*Apply',
    'Application\\s*End\\s*Date',
  ]);
  const attachments = extractAttachments(html);
  const officialUrl =
    (typeof input.officialUrl === 'string' && input.officialUrl.trim()) ||
    firstMatch(html, [
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      /href=["'](https?:\/\/[^"']+)["']/i,
    ]) ||
    null;

  const fields = {
    recruitmentTitle: title,
    advertisementNumber,
    department,
    organization,
    qualification,
    age,
    vacancyCount:
      typeof vacancyCount === 'number' && Number.isFinite(vacancyCount)
        ? vacancyCount
        : null,
    category,
    applicationMode,
    notificationDate,
    lastDate,
    attachments,
    officialUrl,
  };

  const extractedFields = Object.keys(fields).filter((key) => {
    const value = fields[key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  });

  const confidenceBase = extractedFields.length / 12;
  const confidenceScore = Math.min(
    1,
    Math.round((0.35 + confidenceBase * 0.65) * 10000) / 10000
  );

  return deepFreeze({
    parserCapability: PARSER_CAPABILITIES.HTML,
    contentType: CONTENT_TYPES.HTML,
    parserAvailable: true,
    extracted: true,
    fields,
    extractedFields,
    duplicateSections: detectDuplicateSections(html),
    ambiguousFields: detectAmbiguousFields(fields),
    confidenceScore,
    rawExcerpt: plain.slice(0, 500),
  });
}

/**
 * Extract from RSS item / feed text.
 * @param {object} input
 */
function extractFromRss(input = {}) {
  const xml = bodyToText(input.body);
  const itemBlock =
    firstMatch(xml, [/<item[\s\S]*?>([\s\S]*?)<\/item>/i]) || xml;

  const title = firstMatch(itemBlock, [
    /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i,
  ]);
  const link = firstMatch(itemBlock, [
    /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i,
    /<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i,
  ]);
  const pubDate = firstMatch(itemBlock, [
    /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i,
    /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i,
  ]);
  const description = firstMatch(itemBlock, [
    /<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i,
  ]);
  const plain = stripTags(description || '');

  const fields = {
    recruitmentTitle: title ? decodeBasicEntities(title) : null,
    officialUrl: link ? decodeBasicEntities(link) : input.officialUrl || null,
    notificationDate: pubDate ? decodeBasicEntities(pubDate) : null,
    advertisementNumber: extractFieldNearLabel(plain, [
      'Advertisement\\s*(?:No\\.?|Number)',
      'Advt\\.\\s*No\\.?',
    ]),
    lastDate: extractDateNearLabel(plain, ['Last\\s*Date', 'Closing\\s*Date']),
    qualification: extractFieldNearLabel(plain, ['Qualification', 'Eligibility']),
    department: extractFieldNearLabel(plain, ['Department', 'Ministry']),
    organization: extractFieldNearLabel(plain, ['Organization', 'Organisation']),
    category: extractFieldNearLabel(plain, ['Category']),
    applicationMode: null,
    age: null,
    vacancyCount: null,
    attachments: [],
  };

  const extractedFields = Object.keys(fields).filter((key) => {
    const value = fields[key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  });

  return deepFreeze({
    parserCapability: PARSER_CAPABILITIES.RSS,
    contentType: CONTENT_TYPES.RSS,
    parserAvailable: true,
    extracted: true,
    fields,
    extractedFields,
    duplicateSections: [],
    ambiguousFields: detectAmbiguousFields(fields),
    confidenceScore: Math.min(1, 0.4 + extractedFields.length * 0.05),
    rawExcerpt: plain.slice(0, 500),
  });
}

/**
 * Extract from generic XML feed/document.
 * @param {object} input
 */
function extractFromXml(input = {}) {
  const xml = bodyToText(input.body);
  if (/<rss[\s>]/i.test(xml) || /<item[\s>]/i.test(xml)) {
    const rss = extractFromRss(input);
    return deepFreeze({
      ...rss,
      parserCapability: PARSER_CAPABILITIES.XML,
      contentType: CONTENT_TYPES.XML,
    });
  }

  const title = firstMatch(xml, [
    /<title[^>]*>([\s\S]*?)<\/title>/i,
    /<RecruitmentTitle[^>]*>([\s\S]*?)<\/RecruitmentTitle>/i,
    /<Name[^>]*>([\s\S]*?)<\/Name>/i,
  ]);
  const advertisementNumber = firstMatch(xml, [
    /<Advertisement(?:Number|No)[^>]*>([\s\S]*?)<\/Advertisement(?:Number|No)>/i,
    /<AdvtNo[^>]*>([\s\S]*?)<\/AdvtNo>/i,
  ]);
  const officialUrl = firstMatch(xml, [
    /<OfficialUrl[^>]*>([\s\S]*?)<\/OfficialUrl>/i,
    /<Url[^>]*>([\s\S]*?)<\/Url>/i,
    /<Link[^>]*>([\s\S]*?)<\/Link>/i,
  ]);
  const lastDate = firstMatch(xml, [
    /<LastDate[^>]*>([\s\S]*?)<\/LastDate>/i,
    /<ClosingDate[^>]*>([\s\S]*?)<\/ClosingDate>/i,
  ]);
  const notificationDate = firstMatch(xml, [
    /<NotificationDate[^>]*>([\s\S]*?)<\/NotificationDate>/i,
    /<PublishedDate[^>]*>([\s\S]*?)<\/PublishedDate>/i,
  ]);
  const department = firstMatch(xml, [/<Department[^>]*>([\s\S]*?)<\/Department>/i]);
  const organization = firstMatch(xml, [
    /<Organization[^>]*>([\s\S]*?)<\/Organization>/i,
    /<Organisation[^>]*>([\s\S]*?)<\/Organisation>/i,
  ]);
  const qualification = firstMatch(xml, [
    /<Qualification[^>]*>([\s\S]*?)<\/Qualification>/i,
  ]);
  const vacancyRaw = firstMatch(xml, [
    /<VacancyCount[^>]*>([\s\S]*?)<\/VacancyCount>/i,
    /<Vacancies[^>]*>([\s\S]*?)<\/Vacancies>/i,
  ]);

  const fields = {
    recruitmentTitle: title ? decodeBasicEntities(title) : null,
    advertisementNumber: advertisementNumber
      ? decodeBasicEntities(advertisementNumber)
      : null,
    officialUrl: officialUrl
      ? decodeBasicEntities(officialUrl)
      : input.officialUrl || null,
    lastDate: lastDate ? decodeBasicEntities(lastDate) : null,
    notificationDate: notificationDate
      ? decodeBasicEntities(notificationDate)
      : null,
    department: department ? decodeBasicEntities(department) : null,
    organization: organization ? decodeBasicEntities(organization) : null,
    qualification: qualification ? decodeBasicEntities(qualification) : null,
    vacancyCount: vacancyRaw
      ? Number(String(vacancyRaw).replace(/[^\d]/g, '')) || null
      : null,
    category: null,
    applicationMode: null,
    age: null,
    attachments: [],
  };

  const extractedFields = Object.keys(fields).filter((key) => {
    const value = fields[key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  });

  return deepFreeze({
    parserCapability: PARSER_CAPABILITIES.XML,
    contentType: CONTENT_TYPES.XML,
    parserAvailable: true,
    extracted: true,
    fields,
    extractedFields,
    duplicateSections: [],
    ambiguousFields: detectAmbiguousFields(fields),
    confidenceScore: Math.min(1, 0.35 + extractedFields.length * 0.06),
    rawExcerpt: stripTags(xml).slice(0, 500),
  });
}

/**
 * PDF extraction interface — returns unavailable unless a parser is injected.
 * @param {object} input
 */
function extractFromPdf(input = {}) {
  if (typeof input.pdfParser === 'function') {
    const parsed = input.pdfParser({
      body: input.body,
      officialUrl: input.officialUrl,
      sourceId: input.sourceId,
    });
    const fields =
      parsed && typeof parsed === 'object' && parsed.fields
        ? parsed.fields
        : parsed || {};
    const extractedFields = Object.keys(fields).filter((key) => {
      const value = fields[key];
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== '';
    });
    return deepFreeze({
      parserCapability: PARSER_CAPABILITIES.PDF,
      contentType: CONTENT_TYPES.PDF,
      parserAvailable: true,
      extracted: true,
      fields,
      extractedFields,
      duplicateSections: Array.isArray(parsed && parsed.duplicateSections)
        ? parsed.duplicateSections
        : [],
      ambiguousFields: Array.isArray(parsed && parsed.ambiguousFields)
        ? parsed.ambiguousFields
        : detectAmbiguousFields(fields),
      confidenceScore:
        typeof (parsed && parsed.confidenceScore) === 'number'
          ? parsed.confidenceScore
          : Math.min(1, 0.3 + extractedFields.length * 0.05),
      rawExcerpt:
        typeof (parsed && parsed.rawExcerpt) === 'string'
          ? parsed.rawExcerpt.slice(0, 500)
          : null,
    });
  }

  return deepFreeze({
    parserCapability: PARSER_CAPABILITIES.PDF,
    contentType: CONTENT_TYPES.PDF,
    parserAvailable: false,
    extracted: false,
    fields: {
      recruitmentTitle: null,
      advertisementNumber: null,
      department: null,
      organization: null,
      qualification: null,
      age: null,
      vacancyCount: null,
      category: null,
      applicationMode: null,
      notificationDate: null,
      lastDate: null,
      attachments: [],
      officialUrl: input.officialUrl || null,
    },
    extractedFields: input.officialUrl ? ['officialUrl'] : [],
    duplicateSections: [],
    ambiguousFields: [],
    confidenceScore: 0,
    rawExcerpt: null,
    message:
      'PDF parser unavailable — interface only. Inject pdfParser to enable extraction.',
  });
}

/**
 * Dispatch extraction by content type.
 * @param {object} input
 */
function extractByContentType(input = {}) {
  const contentType = String(input.contentType || CONTENT_TYPES.HTML)
    .trim()
    .toUpperCase();

  if (contentType === CONTENT_TYPES.PDF || contentType.includes('PDF')) {
    return extractFromPdf(input);
  }
  if (contentType === CONTENT_TYPES.RSS || contentType.includes('RSS')) {
    return extractFromRss(input);
  }
  if (contentType === CONTENT_TYPES.XML || contentType.includes('XML')) {
    return extractFromXml(input);
  }
  return extractFromHtml(input);
}

module.exports = {
  EXTRACTION_PARSERS_VERSION,
  PARSER_CAPABILITIES,
  extractFromHtml,
  extractFromRss,
  extractFromXml,
  extractFromPdf,
  extractByContentType,
  stripTags,
  bodyToText,
};
