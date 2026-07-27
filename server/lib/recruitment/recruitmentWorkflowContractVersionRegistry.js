"use strict";

/**
 * Phase 138 — Recruitment Workflow Contract Version Registry (Advisory Only).
 *
 * Pure advisory version registry that tracks recruitment workflow runtime
 * integration contract version lifecycle metadata. No database access,
 * no persistence, no runtime imports, no side effects. No automation.
 * Never mutates input. Never persists output.
 */

const RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_PHASE = 138;

const RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_ENTITY =
  "recruitment_workflow_contract_version_registry";

const VERSION_LIFECYCLE = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  STABLE: "STABLE",
  DEPRECATED: "DEPRECATED",
  RETIRED: "RETIRED"
});

const VERSION_IDS = Object.freeze({
  V0_8_0: "0.8.0",
  V0_9_0: "0.9.0",
  V1_0_0: "1.0.0",
  V1_1_0: "1.1.0"
});

const CONTRACT_VERSION_DEFINITIONS = Object.freeze([
  Object.freeze({
    versionId: VERSION_IDS.V0_8_0,
    schemaVersion: "0.8.0",
    lifecycle: VERSION_LIFECYCLE.RETIRED,
    label: "Pre-readiness advisory contract baseline",
    supportedPhases: Object.freeze([114, 115, 116, 117, 118, 119, 120]),
    migrationRequired: false,
    advisoryOnly: true
  }),
  Object.freeze({
    versionId: VERSION_IDS.V0_9_0,
    schemaVersion: "0.9.0",
    lifecycle: VERSION_LIFECYCLE.DEPRECATED,
    label: "Pre-governance advisory contract baseline",
    supportedPhases: Object.freeze([
      114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
      132, 133, 134, 135
    ]),
    migrationRequired: true,
    advisoryOnly: true
  }),
  Object.freeze({
    versionId: VERSION_IDS.V1_0_0,
    schemaVersion: "1.0.0",
    lifecycle: VERSION_LIFECYCLE.ACTIVE,
    label: "Current advisory contract baseline through simulation suite",
    supportedPhases: Object.freeze([
      114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
      132, 133, 134, 135, 136, 137
    ]),
    migrationRequired: false,
    advisoryOnly: true
  }),
  Object.freeze({
    versionId: VERSION_IDS.V1_1_0,
    schemaVersion: "1.1.0",
    lifecycle: VERSION_LIFECYCLE.DRAFT,
    label: "Future runtime integration contract draft",
    supportedPhases: Object.freeze([
      114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
      132, 133, 134, 135, 136, 137, 138
    ]),
    migrationRequired: true,
    advisoryOnly: true
  })
]);

const RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_138",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  versionRegistryOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137
  ])
});

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
 * @param {string} versionId
 * @returns {Readonly<Object>|null}
 */
function getRecruitmentWorkflowContractVersion(versionId) {
  if (typeof versionId !== "string") {
    return null;
  }

  for (let i = 0; i < CONTRACT_VERSION_DEFINITIONS.length; i += 1) {
    const definition = CONTRACT_VERSION_DEFINITIONS[i];

    if (definition.versionId === versionId) {
      return deepFreeze({
        ...definition,
        advisoryMetadata: deepFreeze({
          advisoryOnly: true,
          persistent: false,
          generatedBy: "phase_138",
          phase: RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_PHASE,
          executed: false,
          versionRegistryOnly: true
        })
      });
    }
  }

  return null;
}

/**
 * @returns {Readonly<Array>}
 */
function listRecruitmentWorkflowContractVersions() {
  const versions = CONTRACT_VERSION_DEFINITIONS.map((definition) =>
    deepFreeze({
      versionId: definition.versionId,
      schemaVersion: definition.schemaVersion,
      lifecycle: definition.lifecycle,
      label: definition.label,
      migrationRequired: definition.migrationRequired,
      advisoryOnly: definition.advisoryOnly,
      supportedPhaseCount: definition.supportedPhases.length
    })
  );

  return Object.freeze(versions);
}

/**
 * @param {string} versionId
 * @returns {Readonly<Object>}
 */
function resolveRecruitmentWorkflowContractVersionLifecycle(versionId) {
  const version = getRecruitmentWorkflowContractVersion(versionId);

  if (!version) {
    return deepFreeze({
      versionId: versionId != null ? String(versionId) : null,
      lifecycle: VERSION_LIFECYCLE.DRAFT,
      recognized: false,
      migrationRequired: false,
      integrationPermitted: false,
      lifecycleSummary: "Contract version lifecycle could not be determined",
      advisoryMetadata: deepFreeze({
        advisoryOnly: true,
        persistent: false,
        generatedBy: "phase_138",
        phase: RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_PHASE,
        executed: false,
        versionRegistryOnly: true
      })
    });
  }

  const integrationPermitted =
    version.lifecycle === VERSION_LIFECYCLE.ACTIVE ||
    version.lifecycle === VERSION_LIFECYCLE.STABLE ||
    version.lifecycle === VERSION_LIFECYCLE.DRAFT;

  let lifecycleSummary;

  if (version.lifecycle === VERSION_LIFECYCLE.ACTIVE) {
    lifecycleSummary = `Contract version ${version.versionId} is active for advisory runtime integration review`;
  } else if (version.lifecycle === VERSION_LIFECYCLE.STABLE) {
    lifecycleSummary = `Contract version ${version.versionId} is stable for advisory runtime integration review`;
  } else if (version.lifecycle === VERSION_LIFECYCLE.DEPRECATED) {
    lifecycleSummary = `Contract version ${version.versionId} is deprecated and requires migration planning`;
  } else if (version.lifecycle === VERSION_LIFECYCLE.RETIRED) {
    lifecycleSummary = `Contract version ${version.versionId} is retired and not permitted for integration`;
  } else {
    lifecycleSummary = `Contract version ${version.versionId} is draft and requires advisory review`;
  }

  return deepFreeze({
    versionId: version.versionId,
    lifecycle: version.lifecycle,
    recognized: true,
    migrationRequired: version.migrationRequired,
    integrationPermitted,
    supportedPhases: version.supportedPhases,
    lifecycleSummary,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_138",
      phase: RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_PHASE,
      executed: false,
      versionRegistryOnly: true
    })
  });
}

/**
 * @param {string} sourceVersionId
 * @param {string} targetVersionId
 * @returns {Readonly<Object>}
 */
function compareRecruitmentWorkflowContractVersions(sourceVersionId, targetVersionId) {
  const source = getRecruitmentWorkflowContractVersion(sourceVersionId);
  const target = getRecruitmentWorkflowContractVersion(targetVersionId);

  if (!source || !target) {
    return deepFreeze({
      sourceVersionId: sourceVersionId != null ? String(sourceVersionId) : null,
      targetVersionId: targetVersionId != null ? String(targetVersionId) : null,
      recognized: false,
      upgradePermitted: false,
      migrationRequired: false,
      versionComparisonSummary: "Contract version comparison could not be determined",
      advisoryMetadata: deepFreeze({
        advisoryOnly: true,
        persistent: false,
        generatedBy: "phase_138",
        phase: RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_PHASE,
        executed: false,
        versionRegistryOnly: true
      })
    });
  }

  const upgradePermitted =
    source.lifecycle !== VERSION_LIFECYCLE.RETIRED && target.lifecycle !== VERSION_LIFECYCLE.RETIRED;

  const migrationRequired = source.migrationRequired || target.migrationRequired;

  return deepFreeze({
    sourceVersionId: source.versionId,
    targetVersionId: target.versionId,
    sourceLifecycle: source.lifecycle,
    targetLifecycle: target.lifecycle,
    recognized: true,
    upgradePermitted,
    migrationRequired,
    versionComparisonSummary: upgradePermitted
      ? `Advisory upgrade path from ${source.versionId} to ${target.versionId} is permitted for review`
      : `Advisory upgrade path from ${source.versionId} to ${target.versionId} is not permitted`,
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_138",
      phase: RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_PHASE,
      executed: false,
      versionRegistryOnly: true
    })
  });
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentWorkflowContractVersionEntry(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.versionId === "string" &&
    typeof value.schemaVersion === "string" &&
    typeof value.lifecycle === "string" &&
    value.advisoryOnly === true &&
    value.advisoryMetadata?.versionRegistryOnly === true
  );
}

module.exports = {
  RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_PHASE,
  RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_ENTITY,
  VERSION_LIFECYCLE,
  VERSION_IDS,
  CONTRACT_VERSION_DEFINITIONS,
  RECRUITMENT_WORKFLOW_CONTRACT_VERSION_REGISTRY_METADATA,
  getRecruitmentWorkflowContractVersion,
  listRecruitmentWorkflowContractVersions,
  resolveRecruitmentWorkflowContractVersionLifecycle,
  compareRecruitmentWorkflowContractVersions,
  isRecruitmentWorkflowContractVersionEntry
};
