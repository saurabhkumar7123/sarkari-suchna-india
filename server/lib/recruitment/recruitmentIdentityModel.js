"use strict";

/**
 * Phase 65 — Recruitment Identity Model (foundation).
 *
 * Pure descriptive library defining immutable recruitment identity metadata:
 * identity signals, identity anchors, resolution metadata, and confidence
 * vocabulary. Builds conceptually on Phase 63 domain model and Phase 64
 * lifecycle contracts without import coupling.
 *
 * No runtime integration. No Express. No database. No filesystem. No environment
 * variables. No imports from other recruitment modules.
 */

const IDENTITY_MODEL_PHASE = 65;

/**
 * Descriptive confidence levels — advisory labels only, not computed scores.
 */
const IDENTITY_CONFIDENCE_LEVELS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown"
});

const SUPPORTED_IDENTITY_CONFIDENCE_LEVELS = Object.freeze(
  new Set(Object.values(IDENTITY_CONFIDENCE_LEVELS))
);

const DEFAULT_IDENTITY_CONFIDENCE_LEVEL = IDENTITY_CONFIDENCE_LEVELS.UNKNOWN;

/**
 * Identity source kinds describe where identity signals originate.
 * Descriptive metadata only — not runtime ingestion routing.
 */
const IDENTITY_SOURCE_KINDS = Object.freeze({
  OFFICIAL_NOTIFICATION: "official_notification",
  SHORT_NOTIFICATION: "short_notification",
  CORRECTION_NOTICE: "correction_notice",
  EXAMINATION_NOTICE: "examination_notice",
  RESULT_NOTICE: "result_notice",
  MANUAL_ENTRY: "manual_entry",
  AGGREGATED_FEED: "aggregated_feed",
  UNKNOWN: "unknown"
});

const SUPPORTED_IDENTITY_SOURCE_KINDS = Object.freeze(
  new Set(Object.values(IDENTITY_SOURCE_KINDS))
);

const DEFAULT_IDENTITY_SOURCE_KIND = IDENTITY_SOURCE_KINDS.UNKNOWN;

/**
 * Canonical identity signal keys used to describe recruitment identity facets.
 * Aligned with recruitmentDomainModel field vocabulary (no import coupling).
 */
const IDENTITY_SIGNAL_KEYS = Object.freeze([
  "recruitment_title",
  "organization",
  "advertisement_number",
  "recruitment_year",
  "post_name",
  "department",
  "examination_name",
  "official_identifier",
  "source_url"
]);

const SUPPORTED_IDENTITY_SIGNAL_KEYS = Object.freeze(
  new Set(IDENTITY_SIGNAL_KEYS)
);

/**
 * Ordered catalog of common identity signals.
 */
const IDENTITY_SIGNALS = Object.freeze([
  Object.freeze({
    key: "recruitment_title",
    label: "Recruitment Title",
    description:
      "Human-readable title identifying the recruitment or examination cycle.",
    valueType: "string",
    requiredForResolution: true,
    uniquenessWeight: "high",
    domainField: "title",
    examples: Object.freeze([
      "SSC Combined Graduate Level Examination 2026",
      "UPSC Civil Services Examination 2025"
    ])
  }),
  Object.freeze({
    key: "organization",
    label: "Organization",
    description:
      "Issuing body or recruiting organization responsible for the advertisement.",
    valueType: "string",
    requiredForResolution: false,
    uniquenessWeight: "high",
    domainField: null,
    examples: Object.freeze([
      "Staff Selection Commission",
      "Union Public Service Commission"
    ])
  }),
  Object.freeze({
    key: "advertisement_number",
    label: "Advertisement Number",
    description:
      "Official advertisement, notification, or employment notice number.",
    valueType: "string",
    requiredForResolution: false,
    uniquenessWeight: "high",
    domainField: "advertisement_no",
    examples: Object.freeze(["CGL-01/2026", "Advt. No. 10/2025"])
  }),
  Object.freeze({
    key: "recruitment_year",
    label: "Recruitment Year",
    description: "Calendar or cycle year associated with the recruitment.",
    valueType: "integer",
    requiredForResolution: false,
    uniquenessWeight: "medium",
    domainField: "cycle_year",
    examples: Object.freeze([2025, 2026])
  }),
  Object.freeze({
    key: "post_name",
    label: "Post Name",
    description: "Specific post, cadre, or vacancy name within the recruitment.",
    valueType: "string",
    requiredForResolution: false,
    uniquenessWeight: "medium",
    domainField: "post_name",
    examples: Object.freeze([
      "Assistant Section Officer",
      "Junior Engineer (Civil)"
    ])
  }),
  Object.freeze({
    key: "department",
    label: "Department",
    description:
      "Department, ministry, or organizational unit associated with the vacancy.",
    valueType: "string",
    requiredForResolution: false,
    uniquenessWeight: "medium",
    domainField: "department",
    examples: Object.freeze([
      "Ministry of Railways",
      "Department of Posts"
    ])
  }),
  Object.freeze({
    key: "examination_name",
    label: "Examination Name",
    description:
      "Named examination or selection test when distinct from the recruitment title.",
    valueType: "string",
    requiredForResolution: false,
    uniquenessWeight: "medium",
    domainField: null,
    examples: Object.freeze([
      "Tier-I Examination",
      "Preliminary Examination"
    ])
  }),
  Object.freeze({
    key: "official_identifier",
    label: "Official Identifier",
    description:
      "Stable official identifier such as registration code, exam code, or notice id.",
    valueType: "string",
    requiredForResolution: false,
    uniquenessWeight: "high",
    domainField: null,
    examples: Object.freeze(["EXAM-CGL-2026", "NOTIF-SSC-88421"])
  }),
  Object.freeze({
    key: "source_url",
    label: "Source URL",
    description:
      "Canonical or discovered URL where the identity-bearing document was observed.",
    valueType: "url",
    requiredForResolution: false,
    uniquenessWeight: "low",
    domainField: null,
    examples: Object.freeze([
      "https://ssc.nic.in/notification/cgl-2026",
      "https://upsc.gov.in/exams/civil-services-2025"
    ])
  })
]);

const IDENTITY_SIGNAL_BY_KEY = Object.freeze(
  IDENTITY_SIGNALS.reduce((acc, signal) => {
    acc[signal.key] = signal;
    return acc;
  }, {})
);

/**
 * Lifecycle events that serve as identity anchors.
 * Aligned with recruitmentDomainModel PRIMARY_EVENT_CONCEPT and
 * recruitmentLifecycleContracts primary contracts (no import coupling).
 */
const IDENTITY_ANCHORS = Object.freeze([
  Object.freeze({
    id: "notification",
    lifecycleEventId: "notification",
    eventType: "notification",
    role: "primary_identity_anchor",
    label: "Notification",
    description:
      "Primary lifecycle event that establishes recruitment identity and advertisement context.",
    order: 10,
    establishesRecruitment: true,
    primary: true,
    alternate: false,
    typicalSignals: Object.freeze([
      "recruitment_title",
      "organization",
      "advertisement_number",
      "recruitment_year",
      "post_name",
      "department",
      "official_identifier",
      "source_url"
    ]),
    advisoryNotes: Object.freeze([
      "First authoritative identity anchor for most recruitment cycles.",
      "Typically provides the strongest combination of advertisement_number and title signals."
    ])
  }),
  Object.freeze({
    id: "short_notification",
    lifecycleEventId: "short_notification",
    eventType: "short_notification",
    role: "alternate_identity_anchor",
    label: "Short Notification",
    description:
      "Alternate lifecycle event that may establish or precede recruitment identity before a full notification.",
    order: 12,
    establishesRecruitment: true,
    primary: true,
    alternate: true,
    typicalSignals: Object.freeze([
      "recruitment_title",
      "organization",
      "advertisement_number",
      "recruitment_year",
      "post_name",
      "source_url"
    ]),
    advisoryNotes: Object.freeze([
      "May substitute for notification when only a condensed notice is published first.",
      "Identity resolution may require later confirmation against a full notification."
    ])
  })
]);

const IDENTITY_ANCHOR_BY_ID = Object.freeze(
  IDENTITY_ANCHORS.reduce((acc, anchor) => {
    acc[anchor.id] = anchor;
    return acc;
  }, {})
);

const IDENTITY_ANCHOR_BY_EVENT_TYPE = Object.freeze(
  IDENTITY_ANCHORS.reduce((acc, anchor) => {
    if (anchor.eventType != null) {
      acc[anchor.eventType] = anchor;
    }
    return acc;
  }, {})
);

const SUPPORTED_IDENTITY_ANCHOR_IDS = Object.freeze(
  new Set(IDENTITY_ANCHORS.map((anchor) => anchor.id))
);

const PRIMARY_IDENTITY_ANCHOR_IDS = Object.freeze(
  IDENTITY_ANCHORS.filter((anchor) => anchor.primary && !anchor.alternate).map(
    (anchor) => anchor.id
  )
);

const ALTERNATE_IDENTITY_ANCHOR_IDS = Object.freeze(
  IDENTITY_ANCHORS.filter((anchor) => anchor.alternate).map((anchor) => anchor.id)
);

/**
 * Immutable Identity Source descriptor.
 */
const IDENTITY_SOURCE = Object.freeze({
  concept: "identity_source",
  domain: "recruitment",
  phase: IDENTITY_MODEL_PHASE,
  description:
    "Describes the provenance category from which identity signals were observed or entered.",
  kinds: IDENTITY_SOURCE_KINDS,
  supportedKinds: SUPPORTED_IDENTITY_SOURCE_KINDS,
  defaultKind: DEFAULT_IDENTITY_SOURCE_KIND,
  anchorSourceKindMap: Object.freeze({
    notification: IDENTITY_SOURCE_KINDS.OFFICIAL_NOTIFICATION,
    short_notification: IDENTITY_SOURCE_KINDS.SHORT_NOTIFICATION
  })
});

/**
 * Immutable Identity Confidence descriptor — descriptive labels only.
 */
const IDENTITY_CONFIDENCE = Object.freeze({
  concept: "identity_confidence",
  domain: "recruitment",
  phase: IDENTITY_MODEL_PHASE,
  description:
    "Advisory confidence vocabulary for identity resolution outcomes. Not a computed score.",
  levels: IDENTITY_CONFIDENCE_LEVELS,
  supportedLevels: SUPPORTED_IDENTITY_CONFIDENCE_LEVELS,
  defaultLevel: DEFAULT_IDENTITY_CONFIDENCE_LEVEL,
  advisoryLabels: Object.freeze({
    high: "Strong agreement across primary identity signals and anchor event.",
    medium: "Partial signal agreement; minor ambiguity or missing optional signals.",
    low: "Weak or conflicting signals; identity should be treated as provisional.",
    unknown: "Insufficient metadata to assess confidence descriptively."
  })
});

/**
 * Immutable Identity Resolution Metadata descriptor.
 */
const IDENTITY_RESOLUTION_METADATA = Object.freeze({
  concept: "identity_resolution_metadata",
  domain: "recruitment",
  phase: IDENTITY_MODEL_PHASE,
  description:
    "Descriptive metadata shape for recording how recruitment identity was resolved from signals.",
  fields: Object.freeze({
    anchorEventId: Object.freeze({
      name: "anchorEventId",
      type: "string",
      required: true,
      description: "Lifecycle event id that served as the identity anchor."
    }),
    sourceKind: Object.freeze({
      name: "sourceKind",
      type: "enum",
      required: false,
      allowedValues: SUPPORTED_IDENTITY_SOURCE_KINDS,
      defaultValue: DEFAULT_IDENTITY_SOURCE_KIND,
      description: "Provenance category for the resolving source."
    }),
    confidenceLevel: Object.freeze({
      name: "confidenceLevel",
      type: "enum",
      required: false,
      allowedValues: SUPPORTED_IDENTITY_CONFIDENCE_LEVELS,
      defaultValue: DEFAULT_IDENTITY_CONFIDENCE_LEVEL,
      description: "Advisory confidence label — descriptive only."
    }),
    signalKeys: Object.freeze({
      name: "signalKeys",
      type: "string_array",
      required: false,
      description: "Identity signal keys that contributed to resolution."
    }),
    resolvedAt: Object.freeze({
      name: "resolvedAt",
      type: "datetime",
      required: false,
      description: "Timestamp when identity resolution was recorded."
    }),
    notes: Object.freeze({
      name: "notes",
      type: "string",
      required: false,
      description: "Free-form advisory notes about resolution context."
    })
  }),
  requiredFields: Object.freeze(["anchorEventId"]),
  optionalFields: Object.freeze([
    "sourceKind",
    "confidenceLevel",
    "signalKeys",
    "resolvedAt",
    "notes"
  ])
});

/**
 * Immutable Recruitment Identity aggregate descriptor.
 */
const RECRUITMENT_IDENTITY = Object.freeze({
  entity: "recruitment_identity",
  domain: "recruitment",
  phase: IDENTITY_MODEL_PHASE,
  description:
    "Descriptive aggregate representing the resolved identity of a recruitment cycle from observable signals and anchor events.",
  signals: IDENTITY_SIGNALS,
  signalKeys: IDENTITY_SIGNAL_KEYS,
  anchors: IDENTITY_ANCHORS,
  primaryAnchorIds: PRIMARY_IDENTITY_ANCHOR_IDS,
  alternateAnchorIds: ALTERNATE_IDENTITY_ANCHOR_IDS,
  sourceConcept: IDENTITY_SOURCE,
  confidenceConcept: IDENTITY_CONFIDENCE,
  resolutionMetadataConcept: IDENTITY_RESOLUTION_METADATA,
  requiredSignalKeys: Object.freeze(
    IDENTITY_SIGNALS.filter((signal) => signal.requiredForResolution).map(
      (signal) => signal.key
    )
  ),
  slugDomainField: "slug"
});

const IDENTITY_MODEL_METADATA = Object.freeze({
  phase: IDENTITY_MODEL_PHASE,
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  sideEffects: false,
  buildsOnDomainModelPhase: 63,
  buildsOnLifecycleContractsPhase: 64,
  signalCount: IDENTITY_SIGNALS.length,
  anchorCount: IDENTITY_ANCHORS.length,
  primaryAnchorIds: PRIMARY_IDENTITY_ANCHOR_IDS,
  alternateAnchorIds: ALTERNATE_IDENTITY_ANCHOR_IDS
});

function normalizeKey(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

/**
 * @returns {readonly Object[]}
 */
function getIdentitySignals() {
  return IDENTITY_SIGNALS;
}

/**
 * @param {string} signalKey
 * @returns {Readonly<Object>|null}
 */
function getIdentitySignal(signalKey) {
  const normalized = normalizeKey(signalKey);
  if (normalized == null) {
    return null;
  }
  return IDENTITY_SIGNAL_BY_KEY[normalized] ?? null;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isIdentitySignal(value) {
  const normalized = normalizeKey(value);
  return normalized != null && SUPPORTED_IDENTITY_SIGNAL_KEYS.has(normalized);
}

/**
 * @returns {readonly Object[]}
 */
function listIdentityAnchors() {
  return IDENTITY_ANCHORS;
}

/**
 * @param {string} lifecycleEventId
 * @returns {Readonly<Object>|null}
 */
function getIdentityAnchor(lifecycleEventId) {
  const normalized = normalizeKey(lifecycleEventId);
  if (normalized == null) {
    return null;
  }
  return IDENTITY_ANCHOR_BY_ID[normalized] ?? null;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isIdentityAnchor(value) {
  const normalized = normalizeKey(value);
  return normalized != null && SUPPORTED_IDENTITY_ANCHOR_IDS.has(normalized);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isIdentityConfidenceLevel(value) {
  const normalized = normalizeKey(value);
  return (
    normalized != null && SUPPORTED_IDENTITY_CONFIDENCE_LEVELS.has(normalized)
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isIdentitySourceKind(value) {
  const normalized = normalizeKey(value);
  return normalized != null && SUPPORTED_IDENTITY_SOURCE_KINDS.has(normalized);
}

/**
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentIdentityModel() {
  return Object.freeze({
    phase: IDENTITY_MODEL_PHASE,
    entity: RECRUITMENT_IDENTITY.entity,
    signalCount: IDENTITY_SIGNALS.length,
    anchorCount: IDENTITY_ANCHORS.length,
    primaryAnchorIds: PRIMARY_IDENTITY_ANCHOR_IDS,
    alternateAnchorIds: ALTERNATE_IDENTITY_ANCHOR_IDS,
    requiredSignalKeys: RECRUITMENT_IDENTITY.requiredSignalKeys,
    confidenceLevelCount: SUPPORTED_IDENTITY_CONFIDENCE_LEVELS.size,
    sourceKindCount: SUPPORTED_IDENTITY_SOURCE_KINDS.size,
    descriptiveOnly: true,
    architectureOnly: true,
    runtimeIntegration: false,
    persistenceEnabled: false,
    sideEffects: false,
    buildsOnDomainModelPhase: 63,
    buildsOnLifecycleContractsPhase: 64
  });
}

module.exports = {
  IDENTITY_MODEL_PHASE,
  IDENTITY_CONFIDENCE_LEVELS,
  SUPPORTED_IDENTITY_CONFIDENCE_LEVELS,
  DEFAULT_IDENTITY_CONFIDENCE_LEVEL,
  IDENTITY_CONFIDENCE,
  IDENTITY_SOURCE_KINDS,
  SUPPORTED_IDENTITY_SOURCE_KINDS,
  DEFAULT_IDENTITY_SOURCE_KIND,
  IDENTITY_SOURCE,
  IDENTITY_SIGNAL_KEYS,
  SUPPORTED_IDENTITY_SIGNAL_KEYS,
  IDENTITY_SIGNALS,
  IDENTITY_SIGNAL_BY_KEY,
  IDENTITY_ANCHORS,
  IDENTITY_ANCHOR_BY_ID,
  IDENTITY_ANCHOR_BY_EVENT_TYPE,
  SUPPORTED_IDENTITY_ANCHOR_IDS,
  PRIMARY_IDENTITY_ANCHOR_IDS,
  ALTERNATE_IDENTITY_ANCHOR_IDS,
  IDENTITY_RESOLUTION_METADATA,
  RECRUITMENT_IDENTITY,
  IDENTITY_MODEL_METADATA,
  getIdentitySignals,
  getIdentitySignal,
  isIdentitySignal,
  listIdentityAnchors,
  getIdentityAnchor,
  isIdentityAnchor,
  isIdentityConfidenceLevel,
  isIdentitySourceKind,
  summarizeRecruitmentIdentityModel
};
