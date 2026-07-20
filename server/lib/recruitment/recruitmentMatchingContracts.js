"use strict";

/**
 * Phase 66 — Recruitment Matching Contracts (foundation).
 *
 * Pure descriptive library defining immutable advisory matching concepts:
 * match categories, match signals, matching profiles, manual review scenarios,
 * and matching metadata. Builds conceptually on Phase 63 domain model, Phase 64
 * lifecycle contracts, and Phase 65 identity model without import coupling.
 *
 * No runtime integration. No Express. No database. No filesystem. No environment
 * variables. No imports from other recruitment modules. No score calculation
 * or matching execution.
 */

const MATCHING_CONTRACTS_PHASE = 66;

/**
 * Descriptive match categories — advisory labels only, not computed outcomes.
 */
const MATCH_CATEGORIES = Object.freeze({
  EXACT_MATCH: "exact_match",
  STRONG_MATCH: "strong_match",
  PROBABLE_MATCH: "probable_match",
  WEAK_MATCH: "weak_match",
  NO_MATCH: "no_match",
  MANUAL_REVIEW: "manual_review"
});

const SUPPORTED_MATCH_CATEGORIES = Object.freeze(
  new Set(Object.values(MATCH_CATEGORIES))
);

const DEFAULT_MATCH_CATEGORY = MATCH_CATEGORIES.NO_MATCH;

/**
 * Discriminative weight vocabulary for match signals — descriptive only.
 */
const MATCH_SIGNAL_WEIGHTS = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
});

const SUPPORTED_MATCH_SIGNAL_WEIGHTS = Object.freeze(
  new Set(Object.values(MATCH_SIGNAL_WEIGHTS))
);

/**
 * Canonical match signal keys aligned with recruitmentIdentityModel vocabulary
 * (no import coupling).
 */
const MATCH_SIGNAL_KEYS = Object.freeze([
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

const SUPPORTED_MATCH_SIGNAL_KEYS = Object.freeze(new Set(MATCH_SIGNAL_KEYS));

/**
 * Ordered catalog of match signals used to describe identity-based matching facets.
 */
const MATCH_SIGNALS = Object.freeze([
  Object.freeze({
    key: "advertisement_number",
    label: "Advertisement Number",
    description:
      "Official advertisement or notification number — strongest single discriminator when present and consistent.",
    identitySignalKey: "advertisement_number",
    matchingRole: "primary",
    discriminativeWeight: MATCH_SIGNAL_WEIGHTS.HIGH,
    conflictTriggersReview: true,
    examples: Object.freeze(["CGL-01/2026", "Advt. No. 10/2025"])
  }),
  Object.freeze({
    key: "official_identifier",
    label: "Official Identifier",
    description:
      "Stable official code or notice identifier — high discriminative value when aligned across sources.",
    identitySignalKey: "official_identifier",
    matchingRole: "primary",
    discriminativeWeight: MATCH_SIGNAL_WEIGHTS.HIGH,
    conflictTriggersReview: false,
    examples: Object.freeze(["EXAM-CGL-2026", "NOTIF-SSC-88421"])
  }),
  Object.freeze({
    key: "organization",
    label: "Organization",
    description:
      "Issuing recruiting body — corroborates identity and may trigger review when conflicting.",
    identitySignalKey: "organization",
    matchingRole: "primary",
    discriminativeWeight: MATCH_SIGNAL_WEIGHTS.HIGH,
    conflictTriggersReview: true,
    examples: Object.freeze([
      "Staff Selection Commission",
      "Union Public Service Commission"
    ])
  }),
  Object.freeze({
    key: "recruitment_year",
    label: "Recruitment Year",
    description:
      "Cycle or calendar year — narrows candidate matches; conflicting years warrant manual review.",
    identitySignalKey: "recruitment_year",
    matchingRole: "secondary",
    discriminativeWeight: MATCH_SIGNAL_WEIGHTS.MEDIUM,
    conflictTriggersReview: true,
    examples: Object.freeze([2025, 2026])
  }),
  Object.freeze({
    key: "recruitment_title",
    label: "Recruitment Title",
    description:
      "Human-readable recruitment title — useful corroboration but weaker alone due to naming variance.",
    identitySignalKey: "recruitment_title",
    matchingRole: "secondary",
    discriminativeWeight: MATCH_SIGNAL_WEIGHTS.MEDIUM,
    conflictTriggersReview: false,
    examples: Object.freeze([
      "SSC Combined Graduate Level Examination 2026",
      "UPSC Civil Services Examination 2025"
    ])
  }),
  Object.freeze({
    key: "examination_name",
    label: "Examination Name",
    description:
      "Named examination or test when distinct from the recruitment title.",
    identitySignalKey: "examination_name",
    matchingRole: "corroborating",
    discriminativeWeight: MATCH_SIGNAL_WEIGHTS.MEDIUM,
    conflictTriggersReview: false,
    examples: Object.freeze(["Tier-I Examination", "Preliminary Examination"])
  }),
  Object.freeze({
    key: "post_name",
    label: "Post Name",
    description: "Specific post or cadre within the recruitment cycle.",
    identitySignalKey: "post_name",
    matchingRole: "corroborating",
    discriminativeWeight: MATCH_SIGNAL_WEIGHTS.MEDIUM,
    conflictTriggersReview: false,
    examples: Object.freeze([
      "Assistant Section Officer",
      "Junior Engineer (Civil)"
    ])
  }),
  Object.freeze({
    key: "department",
    label: "Department",
    description: "Department or ministry associated with the vacancy.",
    identitySignalKey: "department",
    matchingRole: "corroborating",
    discriminativeWeight: MATCH_SIGNAL_WEIGHTS.LOW,
    conflictTriggersReview: false,
    examples: Object.freeze([
      "Ministry of Railways",
      "Department of Posts"
    ])
  }),
  Object.freeze({
    key: "source_url",
    label: "Source URL",
    description:
      "Observed document URL — weak discriminator alone but useful for provenance corroboration.",
    identitySignalKey: "source_url",
    matchingRole: "corroborating",
    discriminativeWeight: MATCH_SIGNAL_WEIGHTS.LOW,
    conflictTriggersReview: false,
    examples: Object.freeze([
      "https://ssc.nic.in/notification/cgl-2026",
      "https://upsc.gov.in/exams/civil-services-2025"
    ])
  })
]);

const MATCH_SIGNAL_BY_KEY = Object.freeze(
  MATCH_SIGNALS.reduce((acc, signal) => {
    acc[signal.key] = signal;
    return acc;
  }, {})
);

/**
 * Descriptive matching profiles — advisory combinations of identity signals.
 * Profiles describe what signal sets typically indicate; they do not compute scores.
 */
const MATCHING_PROFILES = Object.freeze([
  Object.freeze({
    id: "official_identifier_exact",
    label: "Official Identifier Exact",
    category: MATCH_CATEGORIES.EXACT_MATCH,
    order: 10,
    description:
      "Advertisement number and official identifier agree across compared records.",
    requiredSignals: Object.freeze(["advertisement_number", "official_identifier"]),
    optionalSignals: Object.freeze([
      "organization",
      "recruitment_year",
      "recruitment_title"
    ]),
    advisoryNotes: Object.freeze([
      "Highest-confidence descriptive profile when both primary identifiers align.",
      "Does not execute matching — advisory classification only."
    ])
  }),
  Object.freeze({
    id: "advertisement_organization_strong",
    label: "Advertisement and Organization Strong",
    category: MATCH_CATEGORIES.STRONG_MATCH,
    order: 20,
    description:
      "Advertisement number and organization agree; official identifier may be absent.",
    requiredSignals: Object.freeze(["advertisement_number", "organization"]),
    optionalSignals: Object.freeze([
      "recruitment_year",
      "recruitment_title",
      "post_name"
    ]),
    advisoryNotes: Object.freeze([
      "Strong match when the two highest-weight primary signals align.",
      "Absence of official_identifier reduces certainty descriptively, not numerically."
    ])
  }),
  Object.freeze({
    id: "title_organization_year_probable",
    label: "Title Organization Year Probable",
    category: MATCH_CATEGORIES.PROBABLE_MATCH,
    order: 30,
    description:
      "Recruitment title, organization, and year agree but advertisement number is missing or unavailable.",
    requiredSignals: Object.freeze([
      "recruitment_title",
      "organization",
      "recruitment_year"
    ]),
    optionalSignals: Object.freeze([
      "post_name",
      "examination_name",
      "department"
    ]),
    advisoryNotes: Object.freeze([
      "Probable match when secondary signals align without a primary advertisement number.",
      "May warrant confirmation when advertisement_number becomes available."
    ])
  }),
  Object.freeze({
    id: "title_year_weak",
    label: "Title and Year Weak",
    category: MATCH_CATEGORIES.WEAK_MATCH,
    order: 40,
    description:
      "Only recruitment title and year overlap; organization or advertisement number absent or ambiguous.",
    requiredSignals: Object.freeze(["recruitment_title", "recruitment_year"]),
    optionalSignals: Object.freeze(["post_name", "source_url"]),
    advisoryNotes: Object.freeze([
      "Weak descriptive match — insufficient primary discriminators for confident linkage.",
      "Should not be treated as a definitive match without additional signals."
    ])
  }),
  Object.freeze({
    id: "corroborating_only_weak",
    label: "Corroborating Signals Only",
    category: MATCH_CATEGORIES.WEAK_MATCH,
    order: 45,
    description:
      "Only corroborating signals such as post name, department, or source URL overlap.",
    requiredSignals: Object.freeze(["post_name"]),
    optionalSignals: Object.freeze(["department", "source_url", "examination_name"]),
    advisoryNotes: Object.freeze([
      "Corroborating signals alone are insufficient for strong identity linkage.",
      "Useful as supporting evidence within a broader matching assessment."
    ])
  }),
  Object.freeze({
    id: "no_shared_identity_signals",
    label: "No Shared Identity Signals",
    category: MATCH_CATEGORIES.NO_MATCH,
    order: 50,
    description:
      "No meaningful overlap in identity signals between compared recruitment records.",
    requiredSignals: Object.freeze([]),
    optionalSignals: Object.freeze([]),
    advisoryNotes: Object.freeze([
      "Descriptive no-match profile when signal comparison yields no shared facets.",
      "Distinct from manual review — no ambiguity, simply no overlap."
    ])
  }),
  Object.freeze({
    id: "manual_review_ambiguous",
    label: "Manual Review Ambiguous",
    category: MATCH_CATEGORIES.MANUAL_REVIEW,
    order: 60,
    description:
      "Signal comparison yields conflicts or insufficient evidence requiring human review.",
    requiredSignals: Object.freeze([]),
    optionalSignals: Object.freeze(MATCH_SIGNAL_KEYS),
    advisoryNotes: Object.freeze([
      "Catch-all descriptive profile for scenarios routed to manual review.",
      "Actual review routing is determined by review scenario descriptors, not runtime logic here."
    ])
  })
]);

const MATCHING_PROFILE_BY_ID = Object.freeze(
  MATCHING_PROFILES.reduce((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {})
);

const SUPPORTED_MATCHING_PROFILE_IDS = Object.freeze(
  new Set(MATCHING_PROFILES.map((profile) => profile.id))
);

/**
 * Manual review scenario identifiers — advisory routing descriptors only.
 */
const MANUAL_REVIEW_SCENARIO_IDS = Object.freeze([
  "conflicting_advertisement_numbers",
  "insufficient_identity_signals",
  "conflicting_organizations",
  "conflicting_recruitment_years"
]);

const SUPPORTED_MANUAL_REVIEW_SCENARIO_IDS = Object.freeze(
  new Set(MANUAL_REVIEW_SCENARIO_IDS)
);

/**
 * Advisory manual review scenarios describing when human review is warranted.
 */
const MANUAL_REVIEW_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "conflicting_advertisement_numbers",
    label: "Conflicting Advertisement Numbers",
    description:
      "Compared records present different advertisement or notification numbers for the same apparent recruitment.",
    category: MATCH_CATEGORIES.MANUAL_REVIEW,
    order: 10,
    triggerSignals: Object.freeze(["advertisement_number"]),
    relatedProfileId: "manual_review_ambiguous",
    advisoryNotes: Object.freeze([
      "Advertisement number is a high-weight primary signal; conflicts cannot be auto-resolved descriptively.",
      "Reviewer should verify official source documents and correct extraction errors."
    ])
  }),
  Object.freeze({
    id: "insufficient_identity_signals",
    label: "Insufficient Identity Signals",
    description:
      "Too few identity signals are available to classify a match category with advisory confidence.",
    category: MATCH_CATEGORIES.MANUAL_REVIEW,
    order: 20,
    triggerSignals: Object.freeze([]),
    relatedProfileId: "manual_review_ambiguous",
    advisoryNotes: Object.freeze([
      "Occurs when required signals for any non-review profile are absent.",
      "Reviewer may need to gather additional metadata before linkage."
    ])
  }),
  Object.freeze({
    id: "conflicting_organizations",
    label: "Conflicting Organizations",
    description:
      "Compared records attribute the recruitment to different issuing organizations.",
    category: MATCH_CATEGORIES.MANUAL_REVIEW,
    order: 30,
    triggerSignals: Object.freeze(["organization"]),
    relatedProfileId: "manual_review_ambiguous",
    advisoryNotes: Object.freeze([
      "Organization conflicts may indicate distinct recruitments or alias normalization issues.",
      "Manual verification against official notification headers is advised."
    ])
  }),
  Object.freeze({
    id: "conflicting_recruitment_years",
    label: "Conflicting Recruitment Years",
    description:
      "Compared records reference different recruitment or cycle years for the same candidate linkage.",
    category: MATCH_CATEGORIES.MANUAL_REVIEW,
    order: 40,
    triggerSignals: Object.freeze(["recruitment_year"]),
    relatedProfileId: "manual_review_ambiguous",
    advisoryNotes: Object.freeze([
      "Year conflicts may indicate adjacent cycle confusion or re-advertisement.",
      "Reviewer should confirm cycle_year against official notification dates."
    ])
  })
]);

const MANUAL_REVIEW_SCENARIO_BY_ID = Object.freeze(
  MANUAL_REVIEW_SCENARIOS.reduce((acc, scenario) => {
    acc[scenario.id] = scenario;
    return acc;
  }, {})
);

/**
 * Immutable Match Category descriptor.
 */
const MATCH_CATEGORY_DESCRIPTOR = Object.freeze({
  concept: "match_category",
  domain: "recruitment",
  phase: MATCHING_CONTRACTS_PHASE,
  description:
    "Advisory match category vocabulary for recruitment identity linkage outcomes. Not a computed score.",
  categories: MATCH_CATEGORIES,
  supportedCategories: SUPPORTED_MATCH_CATEGORIES,
  defaultCategory: DEFAULT_MATCH_CATEGORY,
  advisoryLabels: Object.freeze({
    exact_match:
      "Primary identity signals fully agree; highest descriptive confidence.",
    strong_match:
      "Key primary signals agree with minor optional signal gaps.",
    probable_match:
      "Secondary signals align; primary identifiers missing or partial.",
    weak_match:
      "Limited signal overlap; linkage is provisional and low confidence.",
    no_match: "No meaningful shared identity signals between compared records.",
    manual_review:
      "Conflicts or insufficient evidence require human review before linkage."
  })
});

/**
 * Immutable Matching Metadata descriptor — shape for recording match assessments.
 */
const MATCHING_METADATA = Object.freeze({
  concept: "matching_metadata",
  domain: "recruitment",
  phase: MATCHING_CONTRACTS_PHASE,
  description:
    "Descriptive metadata shape for recording how recruitment records were assessed for identity linkage.",
  fields: Object.freeze({
    category: Object.freeze({
      name: "category",
      type: "enum",
      required: true,
      allowedValues: SUPPORTED_MATCH_CATEGORIES,
      defaultValue: DEFAULT_MATCH_CATEGORY,
      description: "Advisory match category label — descriptive only."
    }),
    profileId: Object.freeze({
      name: "profileId",
      type: "string",
      required: false,
      allowedValues: SUPPORTED_MATCHING_PROFILE_IDS,
      description: "Matching profile id that best describes the signal combination."
    }),
    reviewScenarioId: Object.freeze({
      name: "reviewScenarioId",
      type: "string",
      required: false,
      allowedValues: SUPPORTED_MANUAL_REVIEW_SCENARIO_IDS,
      description: "Manual review scenario id when category is manual_review."
    }),
    signalKeys: Object.freeze({
      name: "signalKeys",
      type: "string_array",
      required: false,
      description: "Match signal keys that contributed to the assessment."
    }),
    assessedAt: Object.freeze({
      name: "assessedAt",
      type: "datetime",
      required: false,
      description: "Timestamp when the match assessment was recorded."
    }),
    notes: Object.freeze({
      name: "notes",
      type: "string",
      required: false,
      description: "Free-form advisory notes about the match assessment context."
    })
  }),
  requiredFields: Object.freeze(["category"]),
  optionalFields: Object.freeze([
    "profileId",
    "reviewScenarioId",
    "signalKeys",
    "assessedAt",
    "notes"
  ])
});

/**
 * Immutable Recruitment Matching aggregate descriptor.
 */
const RECRUITMENT_MATCHING = Object.freeze({
  entity: "recruitment_matching",
  domain: "recruitment",
  phase: MATCHING_CONTRACTS_PHASE,
  description:
    "Descriptive aggregate representing advisory recruitment identity matching concepts from observable signals.",
  matchSignals: MATCH_SIGNALS,
  matchSignalKeys: MATCH_SIGNAL_KEYS,
  matchingProfiles: MATCHING_PROFILES,
  manualReviewScenarios: MANUAL_REVIEW_SCENARIOS,
  categoryConcept: MATCH_CATEGORY_DESCRIPTOR,
  metadataConcept: MATCHING_METADATA,
  primarySignalKeys: Object.freeze(
    MATCH_SIGNALS.filter((signal) => signal.matchingRole === "primary").map(
      (signal) => signal.key
    )
  ),
  conflictReviewSignalKeys: Object.freeze(
    MATCH_SIGNALS.filter((signal) => signal.conflictTriggersReview).map(
      (signal) => signal.key
    )
  )
});

const MATCHING_CONTRACTS_METADATA = Object.freeze({
  phase: MATCHING_CONTRACTS_PHASE,
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  sideEffects: false,
  scoreCalculation: false,
  matchingExecution: false,
  buildsOnDomainModelPhase: 63,
  buildsOnLifecycleContractsPhase: 64,
  buildsOnIdentityModelPhase: 65,
  matchSignalCount: MATCH_SIGNALS.length,
  matchingProfileCount: MATCHING_PROFILES.length,
  manualReviewScenarioCount: MANUAL_REVIEW_SCENARIOS.length,
  matchCategoryCount: SUPPORTED_MATCH_CATEGORIES.size
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
function getMatchingSignals() {
  return MATCH_SIGNALS;
}

/**
 * @param {string} signalKey
 * @returns {Readonly<Object>|null}
 */
function getMatchingSignal(signalKey) {
  const normalized = normalizeKey(signalKey);
  if (normalized == null) {
    return null;
  }
  return MATCH_SIGNAL_BY_KEY[normalized] ?? null;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isMatchingSignal(value) {
  const normalized = normalizeKey(value);
  return normalized != null && SUPPORTED_MATCH_SIGNAL_KEYS.has(normalized);
}

/**
 * @returns {readonly Object[]}
 */
function getMatchingProfiles() {
  return MATCHING_PROFILES;
}

/**
 * @param {string} profileId
 * @returns {Readonly<Object>|null}
 */
function getMatchingProfile(profileId) {
  const normalized = normalizeKey(profileId);
  if (normalized == null) {
    return null;
  }
  return MATCHING_PROFILE_BY_ID[normalized] ?? null;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isMatchingProfile(value) {
  const normalized = normalizeKey(value);
  return normalized != null && SUPPORTED_MATCHING_PROFILE_IDS.has(normalized);
}

/**
 * @returns {readonly Object[]}
 */
function getReviewScenarios() {
  return MANUAL_REVIEW_SCENARIOS;
}

/**
 * @param {string} scenarioId
 * @returns {Readonly<Object>|null}
 */
function getReviewScenario(scenarioId) {
  const normalized = normalizeKey(scenarioId);
  if (normalized == null) {
    return null;
  }
  return MANUAL_REVIEW_SCENARIO_BY_ID[normalized] ?? null;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isManualReviewScenario(value) {
  const normalized = normalizeKey(value);
  return (
    normalized != null && SUPPORTED_MANUAL_REVIEW_SCENARIO_IDS.has(normalized)
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isMatchCategory(value) {
  const normalized = normalizeKey(value);
  return normalized != null && SUPPORTED_MATCH_CATEGORIES.has(normalized);
}

/**
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentMatchingContracts() {
  return Object.freeze({
    phase: MATCHING_CONTRACTS_PHASE,
    entity: RECRUITMENT_MATCHING.entity,
    matchSignalCount: MATCH_SIGNALS.length,
    matchingProfileCount: MATCHING_PROFILES.length,
    manualReviewScenarioCount: MANUAL_REVIEW_SCENARIOS.length,
    matchCategoryCount: SUPPORTED_MATCH_CATEGORIES.size,
    primarySignalKeys: RECRUITMENT_MATCHING.primarySignalKeys,
    conflictReviewSignalKeys: RECRUITMENT_MATCHING.conflictReviewSignalKeys,
    descriptiveOnly: true,
    architectureOnly: true,
    runtimeIntegration: false,
    persistenceEnabled: false,
    sideEffects: false,
    scoreCalculation: false,
    matchingExecution: false,
    buildsOnDomainModelPhase: 63,
    buildsOnLifecycleContractsPhase: 64,
    buildsOnIdentityModelPhase: 65
  });
}

module.exports = {
  MATCHING_CONTRACTS_PHASE,
  MATCH_CATEGORIES,
  SUPPORTED_MATCH_CATEGORIES,
  DEFAULT_MATCH_CATEGORY,
  MATCH_CATEGORY_DESCRIPTOR,
  MATCH_SIGNAL_WEIGHTS,
  SUPPORTED_MATCH_SIGNAL_WEIGHTS,
  MATCH_SIGNAL_KEYS,
  SUPPORTED_MATCH_SIGNAL_KEYS,
  MATCH_SIGNALS,
  MATCH_SIGNAL_BY_KEY,
  MATCHING_PROFILES,
  MATCHING_PROFILE_BY_ID,
  SUPPORTED_MATCHING_PROFILE_IDS,
  MANUAL_REVIEW_SCENARIO_IDS,
  SUPPORTED_MANUAL_REVIEW_SCENARIO_IDS,
  MANUAL_REVIEW_SCENARIOS,
  MANUAL_REVIEW_SCENARIO_BY_ID,
  MATCHING_METADATA,
  RECRUITMENT_MATCHING,
  MATCHING_CONTRACTS_METADATA,
  getMatchingSignals,
  getMatchingSignal,
  isMatchingSignal,
  getMatchingProfiles,
  getMatchingProfile,
  isMatchingProfile,
  getReviewScenarios,
  getReviewScenario,
  isManualReviewScenario,
  isMatchCategory,
  summarizeRecruitmentMatchingContracts
};
