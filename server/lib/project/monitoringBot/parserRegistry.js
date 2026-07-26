'use strict';

/**
 * GOVERNMENT MONITORING BOT — Package MB-1
 * Parser Registry (Registration Only / No Parsing)
 *
 * Registers parser identifiers, versions, formats, and validation rules.
 * Does not parse content.
 */

const { deepFreeze } = require('./governmentSourceRegistry');
const { CONTENT_TYPES } = require('./monitoringConfiguration');

const PARSER_REGISTRY_VERSION = 'MB1.1.0.0';

/**
 * Default parser registrations referenced by monitoring configuration.
 */
const DEFAULT_PARSER_CONFIG = deepFreeze([
  {
    parserId: 'PARSER_SSC_HTML_V1',
    parserVersion: '1.0.0',
    displayName: 'SSC HTML Notice Parser',
    supportedFormats: [CONTENT_TYPES.HTML],
    validationRules: [
      { ruleId: 'REQUIRE_TITLE', severity: 'ERROR', description: 'Title element required' },
      { ruleId: 'REQUIRE_NOTICE_DATE', severity: 'WARNING', description: 'Notice date preferred' },
    ],
  },
  {
    parserId: 'PARSER_UPSC_HTML_V1',
    parserVersion: '1.0.0',
    displayName: 'UPSC HTML Notice Parser',
    supportedFormats: [CONTENT_TYPES.HTML],
    validationRules: [
      { ruleId: 'REQUIRE_TITLE', severity: 'ERROR', description: 'Title element required' },
      { ruleId: 'REQUIRE_EXAM_NAME', severity: 'WARNING', description: 'Exam name preferred' },
    ],
  },
  {
    parserId: 'PARSER_IBPS_HTML_V1',
    parserVersion: '1.0.0',
    displayName: 'IBPS HTML Notice Parser',
    supportedFormats: [CONTENT_TYPES.HTML],
    validationRules: [
      { ruleId: 'REQUIRE_TITLE', severity: 'ERROR', description: 'Title element required' },
    ],
  },
  {
    parserId: 'PARSER_RRB_HTML_V1',
    parserVersion: '1.0.0',
    displayName: 'RRB HTML Notice Parser',
    supportedFormats: [CONTENT_TYPES.HTML],
    validationRules: [
      { ruleId: 'REQUIRE_TITLE', severity: 'ERROR', description: 'Title element required' },
    ],
  },
  {
    parserId: 'PARSER_NTA_HTML_V1',
    parserVersion: '1.0.0',
    displayName: 'NTA HTML Notice Parser',
    supportedFormats: [CONTENT_TYPES.HTML, CONTENT_TYPES.PDF],
    validationRules: [
      { ruleId: 'REQUIRE_TITLE', severity: 'ERROR', description: 'Title element required' },
      { ruleId: 'ALLOW_PDF_ATTACHMENT', severity: 'INFO', description: 'PDF attachments allowed' },
    ],
  },
  {
    parserId: 'PARSER_GENERIC_RSS_V1',
    parserVersion: '1.0.0',
    displayName: 'Generic RSS Feed Parser',
    supportedFormats: [CONTENT_TYPES.RSS, CONTENT_TYPES.XML],
    validationRules: [
      { ruleId: 'REQUIRE_CHANNEL', severity: 'ERROR', description: 'RSS channel required' },
      { ruleId: 'REQUIRE_ITEM', severity: 'WARNING', description: 'At least one item preferred' },
    ],
  },
  {
    parserId: 'PARSER_GENERIC_JSON_V1',
    parserVersion: '1.0.0',
    displayName: 'Generic JSON Notice Parser',
    supportedFormats: [CONTENT_TYPES.JSON],
    validationRules: [
      { ruleId: 'REQUIRE_JSON_OBJECT', severity: 'ERROR', description: 'Root JSON object required' },
    ],
  },
]);

function normalizeFormats(formats) {
  if (!Array.isArray(formats)) return [CONTENT_TYPES.HTML];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < formats.length; i += 1) {
    if (typeof formats[i] === 'string' && formats[i].trim()) {
      const fmt = formats[i].trim().toUpperCase();
      if (!seen.has(fmt)) {
        seen.add(fmt);
        out.push(fmt);
      }
    }
  }
  return out.length > 0 ? out : [CONTENT_TYPES.HTML];
}

function normalizeValidationRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules.map((rule, index) => {
    if (!rule || typeof rule !== 'object') {
      return {
        ruleId: `RULE_${index + 1}`,
        severity: 'INFO',
        description: '',
      };
    }
    return {
      ruleId:
        typeof rule.ruleId === 'string' && rule.ruleId.trim()
          ? rule.ruleId.trim()
          : `RULE_${index + 1}`,
      severity:
        typeof rule.severity === 'string' && rule.severity.trim()
          ? rule.severity.trim().toUpperCase()
          : 'INFO',
      description:
        typeof rule.description === 'string' ? rule.description.trim() : '',
    };
  });
}

function normalizeParser(parser, index) {
  const parserId =
    typeof parser.parserId === 'string' && parser.parserId.trim()
      ? parser.parserId.trim()
      : `CUSTOM_PARSER_${index + 1}`;

  return {
    parserId,
    parserVersion:
      typeof parser.parserVersion === 'string' && parser.parserVersion.trim()
        ? parser.parserVersion.trim()
        : '1.0.0',
    displayName:
      typeof parser.displayName === 'string' && parser.displayName.trim()
        ? parser.displayName.trim()
        : parserId,
    supportedFormats: normalizeFormats(parser.supportedFormats),
    validationRules: normalizeValidationRules(parser.validationRules),
    parsingEnabled: false,
    executionDenied: true,
  };
}

function normalizeParserConfig(parsers) {
  if (!Array.isArray(parsers) || parsers.length === 0) {
    return DEFAULT_PARSER_CONFIG.map((parser, index) =>
      normalizeParser(
        {
          ...parser,
          supportedFormats: parser.supportedFormats.slice(),
          validationRules: parser.validationRules.map((r) => ({ ...r })),
        },
        index
      )
    );
  }
  return parsers.map((parser, index) => normalizeParser(parser || {}, index));
}

/**
 * Create a parser registration entry (no parsing).
 * @param {object} [input]
 */
function createParserRegistration(input = {}) {
  return deepFreeze(normalizeParser(input, 0));
}

/**
 * Build parser registry.
 * @param {object} [options]
 * @param {Array<object>} [options.parsers]
 */
function createParserRegistry(options = {}) {
  const parsers = normalizeParserConfig(options && options.parsers);
  const byId = {};
  for (let i = 0; i < parsers.length; i += 1) {
    byId[parsers[i].parserId] = parsers[i];
  }

  const ordered = parsers
    .slice()
    .sort((a, b) => a.parserId.localeCompare(b.parserId));

  return deepFreeze({
    registryVersion: PARSER_REGISTRY_VERSION,
    advisoryOnly: true,
    configurationDriven: true,
    versioned: true,
    deterministic: true,
    parsingDenied: true,
    executionDenied: true,
    registrationOnly: true,
    parserCount: ordered.length,
    parserIds: ordered.map((p) => p.parserId),
    parsers: ordered,
    byId,
    defaultParserIds: DEFAULT_PARSER_CONFIG.map((p) => p.parserId),
  });
}

function getDefaultParserRegistry() {
  return createParserRegistry();
}

function getParserRegistration(registry, parserId) {
  if (!registry || !registry.byId || typeof parserId !== 'string') {
    return null;
  }
  return registry.byId[parserId] || null;
}

function listParserRegistrations(registry) {
  if (!registry || !Array.isArray(registry.parsers)) {
    return [];
  }
  return registry.parsers.slice();
}

module.exports = {
  PARSER_REGISTRY_VERSION,
  DEFAULT_PARSER_CONFIG,
  createParserRegistration,
  createParserRegistry,
  getDefaultParserRegistry,
  getParserRegistration,
  listParserRegistrations,
};
