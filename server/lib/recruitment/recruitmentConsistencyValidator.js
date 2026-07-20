"use strict";

/**
 * Phase 143 — Recruitment Consistency Validator (Advisory Only).
 *
 * Pure advisory validator that checks logical consistency across recruitment
 * architecture manifest metadata, dependency maps, and advisory module
 * descriptors. No database access, no persistence, no runtime imports,
 * no side effects. No auto-correction. No automation.
 * Never mutates input. Never persists output.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 * No runtime module imports. No storage assumptions.
 */

const RECRUITMENT_CONSISTENCY_VALIDATOR_PHASE = 143;

const RECRUITMENT_CONSISTENCY_VALIDATOR_ENTITY = "recruitment_consistency_validator";

const VALIDATOR_SCHEMA_VERSION = "1.0.0";

const VALIDATION_STATUS = Object.freeze({
  VALID: "VALID",
  PARTIALLY_VALID: "PARTIALLY_VALID",
  INVALID: "INVALID",
  UNKNOWN: "UNKNOWN"
});

const FINDING_SEVERITY = Object.freeze({
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO"
});

const FINDING_CATEGORY = Object.freeze({
  DUPLICATE_MODULE: "DUPLICATE_MODULE",
  MISSING_SECTION: "MISSING_SECTION",
  INVALID_MATURITY: "INVALID_MATURITY",
  INCONSISTENT_CONFIDENCE: "INCONSISTENT_CONFIDENCE",
  ORDERING_VIOLATION: "ORDERING_VIOLATION",
  MISSING_DEPENDENCY: "MISSING_DEPENDENCY",
  RUNTIME_BOUNDARY: "RUNTIME_BOUNDARY",
  METADATA_INTEGRITY: "METADATA_INTEGRITY"
});

const VALID_MATURITY_LEVELS = Object.freeze(
  new Set([
    "FOUNDATIONAL",
    "ADVISORY_LAYERED",
    "GOVERNANCE_COMPLETE",
    "ADVISORY_COMPLETE"
  ])
);

const REQUIRED_ADVISORY_SECTIONS = Object.freeze([
  "readiness",
  "governance",
  "risks",
  "rollout",
  "observability",
  "diagnostics",
  "documentation",
  "recommendations",
  "nextSteps",
  "confidence"
]);

const RECRUITMENT_CONSISTENCY_VALIDATOR_METADATA = Object.freeze({
  phase: RECRUITMENT_CONSISTENCY_VALIDATOR_PHASE,
  advisoryOnly: true,
  descriptiveOnly: true,
  readOnly: true,
  consistencyValidatorOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  persistent: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  flagExecutionEnabled: false,
  rolloutActivationEnabled: false,
  runtimeWiringEnabled: false,
  executed: false,
  autoCorrectionEnabled: false,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143
  ])
});

const RECRUITMENT_CONSISTENCY_VALIDATOR_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_CONSISTENCY_VALIDATOR_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_CONSISTENCY_VALIDATOR_PHASE,
  description:
    "Pure advisory validator checking recruitment architecture metadata consistency across manifest, dependency, and module descriptors.",
  schemaVersion: VALIDATOR_SCHEMA_VERSION,
  metadata: RECRUITMENT_CONSISTENCY_VALIDATOR_METADATA
});

const EXPECTED_RESULT_KEYS = Object.freeze([
  "recruitmentId",
  "validationStatus",
  "findings",
  "warnings",
  "recommendations",
  "confidence",
  "validatedModuleCount",
  "advisoryMetadata"
]);

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {*}
 */
function deepFreeze(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

/**
 * @param {*} recruitmentId
 * @returns {string}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null || recruitmentId === "") {
    return "UNKNOWN";
  }
  return String(recruitmentId);
}

/**
 * @param {string} category
 * @param {string} severity
 * @param {string} message
 * @param {string} [moduleName]
 * @returns {Readonly<Object>}
 */
function createFinding(category, severity, message, moduleName) {
  return Object.freeze({
    category,
    severity,
    message,
    moduleName: moduleName || null
  });
}

/**
 * @param {*} confidence
 * @returns {boolean}
 */
function isValidConfidence(confidence) {
  return typeof confidence === "number" && !Number.isNaN(confidence) && confidence >= 0 && confidence <= 100;
}

/**
 * @param {Readonly<Array>} modules
 * @param {Readonly<Array>} findings
 * @param {Readonly<Array>} warnings
 */
function checkDuplicateModuleNames(modules, findings, warnings) {
  const seen = {};
  for (let i = 0; i < modules.length; i += 1) {
    const entry = modules[i];
    if (!isPlainObject(entry)) {
      findings.push(
        createFinding(
          FINDING_CATEGORY.METADATA_INTEGRITY,
          FINDING_SEVERITY.ERROR,
          "Module entry is not a plain object.",
          null
        )
      );
      continue;
    }
    const name = entry.moduleId || entry.moduleName;
    if (name == null || name === "") {
      findings.push(
        createFinding(
          FINDING_CATEGORY.METADATA_INTEGRITY,
          FINDING_SEVERITY.ERROR,
          "Module entry is missing moduleId or moduleName.",
          null
        )
      );
      continue;
    }
    if (seen[name] === true) {
      findings.push(
        createFinding(
          FINDING_CATEGORY.DUPLICATE_MODULE,
          FINDING_SEVERITY.ERROR,
          `Duplicate module name detected: ${name}.`,
          name
        )
      );
    } else {
      seen[name] = true;
    }
  }
}

/**
 * @param {Readonly<Array>} sections
 * @param {Readonly<Array>} findings
 * @param {Readonly<Array>} warnings
 */
function checkMissingAdvisorySections(sections, findings, warnings) {
  if (!Array.isArray(sections) || sections.length === 0) {
    findings.push(
      createFinding(
        FINDING_CATEGORY.MISSING_SECTION,
        FINDING_SEVERITY.ERROR,
        "Advisory sections array is missing or empty."
      )
    );
    return;
  }

  const present = new Set();
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    if (isPlainObject(section) && section.sectionId != null) {
      present.add(section.sectionId);
    }
  }

  for (let i = 0; i < REQUIRED_ADVISORY_SECTIONS.length; i += 1) {
    const required = REQUIRED_ADVISORY_SECTIONS[i];
    if (!present.has(required)) {
      findings.push(
        createFinding(
          FINDING_CATEGORY.MISSING_SECTION,
          FINDING_SEVERITY.ERROR,
          `Required advisory section missing: ${required}.`
        )
      );
    }
  }
}

/**
 * @param {*} maturityLevel
 * @param {Readonly<Array>} findings
 * @param {Readonly<Array>} warnings
 */
function checkMaturityLevel(maturityLevel, findings, warnings) {
  if (maturityLevel == null || maturityLevel === "") {
    findings.push(
      createFinding(
        FINDING_CATEGORY.INVALID_MATURITY,
        FINDING_SEVERITY.ERROR,
        "Maturity level is missing."
      )
    );
    return;
  }
  if (!VALID_MATURITY_LEVELS.has(maturityLevel)) {
    findings.push(
      createFinding(
        FINDING_CATEGORY.INVALID_MATURITY,
        FINDING_SEVERITY.ERROR,
        `Invalid maturity level: ${String(maturityLevel)}.`
      )
    );
  }
}

/**
 * @param {Readonly<Array>} moduleDescriptors
 * @param {Readonly<Array>} findings
 * @param {Readonly<Array>} warnings
 */
function checkConfidenceValues(moduleDescriptors, findings, warnings) {
  if (!Array.isArray(moduleDescriptors)) {
    return;
  }
  for (let i = 0; i < moduleDescriptors.length; i += 1) {
    const descriptor = moduleDescriptors[i];
    if (!isPlainObject(descriptor)) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, "confidence")) {
      continue;
    }
    if (!isValidConfidence(descriptor.confidence)) {
      const name = descriptor.moduleId || descriptor.moduleName || "unknown";
      findings.push(
        createFinding(
          FINDING_CATEGORY.INCONSISTENT_CONFIDENCE,
          FINDING_SEVERITY.ERROR,
          `Confidence value must be a number between 0 and 100 for module ${name}.`,
          name
        )
      );
    }
  }
}

/**
 * @param {Readonly<Array>} modules
 * @param {Readonly<Array>} findings
 * @param {Readonly<Array>} warnings
 */
function checkModuleOrdering(modules, findings, warnings) {
  if (!Array.isArray(modules) || modules.length < 2) {
    return;
  }
  let lastOrder = -1;
  for (let i = 0; i < modules.length; i += 1) {
    const entry = modules[i];
    if (!isPlainObject(entry) || typeof entry.order !== "number") {
      warnings.push(
        createFinding(
          FINDING_CATEGORY.ORDERING_VIOLATION,
          FINDING_SEVERITY.WARNING,
          "Module entry missing numeric order field.",
          entry && (entry.moduleId || entry.moduleName)
        )
      );
      continue;
    }
    if (entry.order < lastOrder) {
      const name = entry.moduleId || entry.moduleName || "unknown";
      findings.push(
        createFinding(
          FINDING_CATEGORY.ORDERING_VIOLATION,
          FINDING_SEVERITY.ERROR,
          `Module order violation: ${name} has order ${entry.order} after ${lastOrder}.`,
          name
        )
      );
    }
    lastOrder = entry.order;
  }
}

/**
 * @param {Readonly<Array>} relationships
 * @param {Readonly<Set>} knownModules
 * @param {Readonly<Array>} findings
 * @param {Readonly<Array>} warnings
 */
function checkMissingDependencies(relationships, knownModules, findings, warnings) {
  if (!Array.isArray(relationships)) {
    return;
  }
  for (let i = 0; i < relationships.length; i += 1) {
    const rel = relationships[i];
    if (!isPlainObject(rel) || !Array.isArray(rel.dependsOn)) {
      continue;
    }
    const moduleId = rel.moduleId;
    for (let j = 0; j < rel.dependsOn.length; j += 1) {
      const dep = rel.dependsOn[j];
      if (!knownModules.has(dep)) {
        findings.push(
          createFinding(
            FINDING_CATEGORY.MISSING_DEPENDENCY,
            FINDING_SEVERITY.ERROR,
            `Module ${moduleId} depends on unknown module: ${dep}.`,
            moduleId
          )
        );
      }
    }
  }
}

/**
 * @param {Readonly<Array>} boundaries
 * @param {Readonly<Array>} findings
 * @param {Readonly<Array>} warnings
 */
function checkRuntimeBoundaries(boundaries, findings, warnings) {
  if (!Array.isArray(boundaries) || boundaries.length === 0) {
    warnings.push(
      createFinding(
        FINDING_CATEGORY.RUNTIME_BOUNDARY,
        FINDING_SEVERITY.WARNING,
        "Execution boundaries are missing from validation input."
      )
    );
    return;
  }
  for (let i = 0; i < boundaries.length; i += 1) {
    const boundary = boundaries[i];
    if (!isPlainObject(boundary)) {
      continue;
    }
    if (boundary.isolated !== true && boundary.advisoryImportsAllowed !== false) {
      warnings.push(
        createFinding(
          FINDING_CATEGORY.RUNTIME_BOUNDARY,
          FINDING_SEVERITY.WARNING,
          `Runtime boundary ${boundary.id || boundary.boundary || "unknown"} may not be fully isolated.`,
          null
        )
      );
    }
  }
}

/**
 * @param {Readonly<Array>} findings
 * @param {Readonly<Array>} warnings
 * @returns {string}
 */
function resolveValidationStatus(findings, warnings) {
  const hasError = findings.some((f) => f.severity === FINDING_SEVERITY.ERROR);
  if (hasError) {
    return VALIDATION_STATUS.INVALID;
  }
  if (warnings.length > 0) {
    return VALIDATION_STATUS.PARTIALLY_VALID;
  }
  return VALIDATION_STATUS.VALID;
}

/**
 * @param {string} validationStatus
 * @param {Readonly<Array>} findings
 * @param {Readonly<Array>} warnings
 * @returns {Readonly<Array>}
 */
function buildRecommendations(validationStatus, findings, warnings) {
  const recommendations = [];
  if (validationStatus === VALIDATION_STATUS.VALID) {
    recommendations.push("Advisory architecture metadata is internally consistent.");
    recommendations.push("Maintain runtime isolation boundaries before any future integration review.");
    return Object.freeze(recommendations.slice());
  }

  const categories = new Set();
  for (let i = 0; i < findings.length; i += 1) {
    categories.add(findings[i].category);
  }
  for (let i = 0; i < warnings.length; i += 1) {
    categories.add(warnings[i].category);
  }

  if (categories.has(FINDING_CATEGORY.DUPLICATE_MODULE)) {
    recommendations.push("Resolve duplicate module identifiers in the advisory manifest.");
  }
  if (categories.has(FINDING_CATEGORY.MISSING_SECTION)) {
    recommendations.push("Populate all required advisory sections before release readiness review.");
  }
  if (categories.has(FINDING_CATEGORY.INVALID_MATURITY)) {
    recommendations.push("Set maturity level to a recognized advisory architecture value.");
  }
  if (categories.has(FINDING_CATEGORY.INCONSISTENT_CONFIDENCE)) {
    recommendations.push("Normalize confidence values to the 0–100 advisory range.");
  }
  if (categories.has(FINDING_CATEGORY.ORDERING_VIOLATION)) {
    recommendations.push("Reorder advisory modules to maintain stable ascending order.");
  }
  if (categories.has(FINDING_CATEGORY.MISSING_DEPENDENCY)) {
    recommendations.push("Register missing upstream modules in the dependency map.");
  }
  if (categories.has(FINDING_CATEGORY.RUNTIME_BOUNDARY)) {
    recommendations.push("Verify runtime isolation boundaries remain enforced.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Review advisory metadata findings and warnings.");
  }

  return Object.freeze(recommendations.slice());
}

/**
 * @param {string} validationStatus
 * @param {number} errorCount
 * @param {number} warningCount
 * @param {number} moduleCount
 * @returns {number}
 */
function calculateConfidence(validationStatus, errorCount, warningCount, moduleCount) {
  if (validationStatus === VALIDATION_STATUS.UNKNOWN) {
    return 0;
  }
  if (moduleCount === 0) {
    return 0;
  }
  let score = 100;
  score -= errorCount * 15;
  score -= warningCount * 5;
  if (validationStatus === VALIDATION_STATUS.PARTIALLY_VALID) {
    score = Math.min(score, 75);
  }
  if (validationStatus === VALIDATION_STATUS.INVALID) {
    score = Math.min(score, 40);
  }
  if (score < 0) {
    return 0;
  }
  if (score > 100) {
    return 100;
  }
  return score;
}

/**
 * @param {*} input
 * @returns {Readonly<Object>}
 */
function validateRecruitmentArchitectureConsistency(input) {
  const safeInput = isPlainObject(input) ? input : {};
  const recruitmentId = resolveRecruitmentId(safeInput.recruitmentId);

  const manifest = isPlainObject(safeInput.architectureManifest) ? safeInput.architectureManifest : null;
  const dependencyMap = isPlainObject(safeInput.dependencyMap) ? safeInput.dependencyMap : null;

  const findings = [];
  const warnings = [];

  if (manifest == null && dependencyMap == null && !Array.isArray(safeInput.moduleDescriptors)) {
    return deepFreeze({
      recruitmentId,
      validationStatus: VALIDATION_STATUS.UNKNOWN,
      findings: Object.freeze([]),
      warnings: Object.freeze([
        createFinding(
          FINDING_CATEGORY.METADATA_INTEGRITY,
          FINDING_SEVERITY.WARNING,
          "No architecture manifest, dependency map, or module descriptors provided for validation."
        )
      ]),
      recommendations: Object.freeze([
        "Provide architectureManifest and dependencyMap for full consistency validation."
      ]),
      confidence: 0,
      validatedModuleCount: 0,
      advisoryMetadata: Object.freeze({
        advisoryOnly: true,
        descriptiveOnly: true,
        persistent: false,
        generatedBy: "phase_143",
        phase: RECRUITMENT_CONSISTENCY_VALIDATOR_PHASE,
        consistencyValidatorOnly: true,
        executed: false,
        runtimeIntegration: false,
        persistenceEnabled: false,
        sideEffects: false,
        mutatesInput: false,
        mutatesProduction: false,
        flagExecutionEnabled: false,
        rolloutActivationEnabled: false,
        runtimeWiringEnabled: false,
        autoCorrectionEnabled: false
      })
    });
  }

  const modules = manifest != null && Array.isArray(manifest.advisoryModules)
    ? manifest.advisoryModules
    : Array.isArray(safeInput.moduleDescriptors)
      ? safeInput.moduleDescriptors
      : [];

  const sections = manifest != null && Array.isArray(manifest.advisorySections)
    ? manifest.advisorySections
    : Array.isArray(safeInput.advisorySections)
      ? safeInput.advisorySections
      : [];

  const maturityLevel = manifest != null ? manifest.maturityLevel : safeInput.maturityLevel;
  const relationships = dependencyMap != null && Array.isArray(dependencyMap.moduleRelationships)
    ? dependencyMap.moduleRelationships
    : Array.isArray(safeInput.moduleRelationships)
      ? safeInput.moduleRelationships
      : [];

  const boundaries = manifest != null && Array.isArray(manifest.executionBoundaries)
    ? manifest.executionBoundaries
    : dependencyMap != null && Array.isArray(dependencyMap.runtimeIsolationBoundaries)
      ? dependencyMap.runtimeIsolationBoundaries
      : [];

  const moduleDescriptors = Array.isArray(safeInput.moduleDescriptors)
    ? safeInput.moduleDescriptors
    : modules;

  checkDuplicateModuleNames(modules, findings, warnings);
  checkMissingAdvisorySections(sections, findings, warnings);
  checkMaturityLevel(maturityLevel, findings, warnings);
  checkConfidenceValues(moduleDescriptors, findings, warnings);
  checkModuleOrdering(modules, findings, warnings);

  const knownModules = new Set();
  for (let i = 0; i < modules.length; i += 1) {
    const entry = modules[i];
    if (isPlainObject(entry)) {
      const name = entry.moduleId || entry.moduleName;
      if (name != null) {
        knownModules.add(name);
      }
    }
  }
  checkMissingDependencies(relationships, knownModules, findings, warnings);
  checkRuntimeBoundaries(boundaries, findings, warnings);

  const frozenFindings = Object.freeze(findings.slice());
  const frozenWarnings = Object.freeze(
    warnings.filter((w) => w.severity === FINDING_SEVERITY.WARNING).concat(
      findings.filter((f) => f.severity === FINDING_SEVERITY.WARNING)
    )
  );
  const errorFindings = Object.freeze(
    frozenFindings.filter((f) => f.severity === FINDING_SEVERITY.ERROR)
  );
  const validationStatus = resolveValidationStatus(errorFindings, frozenWarnings);
  const recommendations = buildRecommendations(validationStatus, errorFindings, frozenWarnings);
  const confidence = calculateConfidence(
    validationStatus,
    errorFindings.length,
    frozenWarnings.length,
    modules.length
  );

  return deepFreeze({
    recruitmentId,
    validationStatus,
    findings: errorFindings,
    warnings: frozenWarnings,
    recommendations,
    confidence,
    validatedModuleCount: modules.length,
    advisoryMetadata: Object.freeze({
      advisoryOnly: true,
      descriptiveOnly: true,
      persistent: false,
      generatedBy: "phase_143",
      phase: RECRUITMENT_CONSISTENCY_VALIDATOR_PHASE,
      consistencyValidatorOnly: true,
      executed: false,
      runtimeIntegration: false,
      persistenceEnabled: false,
      sideEffects: false,
      mutatesInput: false,
      mutatesProduction: false,
      flagExecutionEnabled: false,
      rolloutActivationEnabled: false,
      runtimeWiringEnabled: false,
      autoCorrectionEnabled: false
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentConsistencyValidationResult(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  for (let i = 0; i < EXPECTED_RESULT_KEYS.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, EXPECTED_RESULT_KEYS[i])) {
      return false;
    }
  }
  if (value.advisoryMetadata == null || value.advisoryMetadata.advisoryOnly !== true) {
    return false;
  }
  if (value.advisoryMetadata.executed !== false) {
    return false;
  }
  if (!Object.isFrozen(value)) {
    return false;
  }
  return true;
}

module.exports = {
  RECRUITMENT_CONSISTENCY_VALIDATOR_PHASE,
  RECRUITMENT_CONSISTENCY_VALIDATOR_ENTITY,
  VALIDATOR_SCHEMA_VERSION,
  VALIDATION_STATUS,
  FINDING_SEVERITY,
  FINDING_CATEGORY,
  VALID_MATURITY_LEVELS,
  REQUIRED_ADVISORY_SECTIONS,
  RECRUITMENT_CONSISTENCY_VALIDATOR_METADATA,
  RECRUITMENT_CONSISTENCY_VALIDATOR_DESCRIPTOR,
  EXPECTED_RESULT_KEYS,
  validateRecruitmentArchitectureConsistency,
  isRecruitmentConsistencyValidationResult
};
