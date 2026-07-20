"use strict";

/**
 * Phase 119 — Recruitment Draft Repository Contract.
 *
 * Pure architecture contract that maps Phase 118 storage payloads into future
 * repository-layer intent without database access, SQL generation, repository
 * implementation, coordinator invocation, pipeline mutations, or side effects.
 *
 * No Express. No database. No filesystem. No network access.
 * No worker. No routing. No publishing. No execution changes.
 */

const {
  RECRUITMENT_DRAFT_PROPOSAL_TYPES
} = require("./recruitmentDraftProposalEngine");

const {
  RECRUITMENT_DRAFT_PERSISTENCE_ENTITY
} = require("./recruitmentDraftPersistenceBoundary");

const {
  RECRUITMENT_DRAFT_STORAGE_ACTIONS,
  isRecruitmentDraftStoragePayload
} = require("./recruitmentDraftStorageAdapter");

const RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_PHASE = 119;

const RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_ENTITY = "recruitment_draft_repository_contract";

const RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_VERSION = "1.0.0";

const RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS = Object.freeze({
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  NO_ACTION: "NO_ACTION"
});

const STORAGE_ACTION_TO_REPOSITORY_OPERATION = Object.freeze({
  [RECRUITMENT_DRAFT_STORAGE_ACTIONS.CREATE_DRAFT_RECORD]:
    RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.CREATE,
  [RECRUITMENT_DRAFT_STORAGE_ACTIONS.UPDATE_DRAFT_RECORD]:
    RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.UPDATE,
  [RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW]:
    RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.REVIEW_REQUIRED,
  [RECRUITMENT_DRAFT_STORAGE_ACTIONS.NO_STORAGE_ACTION]:
    RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.NO_ACTION
});

const DEFAULT_TARGET_PRIMARY_TABLE = "generator_drafts";

const DEFAULT_TARGET_RELATED_TABLES = Object.freeze(["content_imports", "pages"]);

const RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA = Object.freeze({
  phase: RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_PHASE,
  descriptiveOnly: true,
  readOnly: true,
  repositoryContractOnly: true,
  architectureOnly: true,
  advisoryOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  queriesDatabase: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  performsStateTransitions: false,
  createsDrafts: false,
  publishesPages: false,
  invokesCoordinator: false,
  pipelineWiring: false,
  sourcePhases: Object.freeze([118])
});

const RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_DESCRIPTOR = Object.freeze({
  entity: RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_ENTITY,
  domain: "recruitment",
  phase: RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_PHASE,
  description:
    "Pure advisory repository contract projecting Phase 118 storage payloads into future repository intent.",
  metadata: RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA
});

const EMPTY_REPOSITORY_CONTRACT_SUMMARY = Object.freeze({
  operation: RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.REVIEW_REQUIRED,
  entity: null,
  lifecycleEvent: "UNKNOWN",
  proposalType: RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW,
  createAllowed: false,
  updateAllowed: false,
  requiresHumanApproval: true,
  primaryTable: null
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
 * @param {string} operation
 * @returns {string|null}
 */
function resolveEntityForOperation(operation) {
  if (
    operation === RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.CREATE ||
    operation === RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.UPDATE
  ) {
    return RECRUITMENT_DRAFT_PERSISTENCE_ENTITY;
  }

  return null;
}

/**
 * @param {string} storageAction
 * @returns {string}
 */
function resolveRepositoryOperation(storageAction) {
  return (
    STORAGE_ACTION_TO_REPOSITORY_OPERATION[storageAction] ??
    RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.REVIEW_REQUIRED
  );
}

/**
 * @param {string} operation
 * @param {Readonly<Object>} draftMetadata
 * @returns {Readonly<Object>}
 */
function resolveRepositoryIntent(operation, draftMetadata) {
  const requiresHumanReview = draftMetadata.requiresHumanReview === true;

  if (operation === RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.CREATE) {
    return Object.freeze({
      createAllowed: true,
      updateAllowed: false,
      requiresHumanApproval: requiresHumanReview
    });
  }

  if (operation === RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.UPDATE) {
    return Object.freeze({
      createAllowed: false,
      updateAllowed: true,
      requiresHumanApproval: requiresHumanReview
    });
  }

  if (operation === RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.REVIEW_REQUIRED) {
    return Object.freeze({
      createAllowed: false,
      updateAllowed: false,
      requiresHumanApproval: true
    });
  }

  return Object.freeze({
    createAllowed: false,
    updateAllowed: false,
    requiresHumanApproval: false
  });
}

/**
 * @param {string} storageAction
 * @param {Readonly<Object>|null|undefined} repositoryHints
 * @returns {Readonly<Object>}
 */
function resolveTargetHints(storageAction, repositoryHints) {
  const hasStorageTarget =
    storageAction === RECRUITMENT_DRAFT_STORAGE_ACTIONS.CREATE_DRAFT_RECORD ||
    storageAction === RECRUITMENT_DRAFT_STORAGE_ACTIONS.UPDATE_DRAFT_RECORD;

  if (!hasStorageTarget) {
    return deepFreeze({
      primaryTable: null,
      relatedTables: Object.freeze([])
    });
  }

  let primaryTable = DEFAULT_TARGET_PRIMARY_TABLE;
  let relatedTables = [...DEFAULT_TARGET_RELATED_TABLES];

  if (isPlainObject(repositoryHints)) {
    if (
      typeof repositoryHints.primaryTable === "string" &&
      repositoryHints.primaryTable.length > 0
    ) {
      primaryTable = repositoryHints.primaryTable;
    }

    if (Array.isArray(repositoryHints.relatedTables)) {
      const filtered = [];
      for (let i = 0; i < repositoryHints.relatedTables.length; i += 1) {
        const table = repositoryHints.relatedTables[i];
        if (typeof table === "string" && table.length > 0) {
          filtered.push(table);
        }
      }
      if (filtered.length > 0) {
        relatedTables = filtered;
      }
    }
  }

  return deepFreeze({
    primaryTable,
    relatedTables: deepFreeze(relatedTables.slice())
  });
}

/**
 * @param {Readonly<Object>} params
 * @returns {Readonly<Object>}
 */
function buildRepositoryContractResult(params) {
  return deepFreeze({
    contractVersion: RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_VERSION,
    operation: params.operation,
    entity: params.entity,
    draftMapping: deepFreeze({
      lifecycleEvent: params.lifecycleEvent,
      proposalType: params.proposalType,
      titleHint: params.titleHint ?? null,
      sourceIdentifier: params.sourceIdentifier ?? null
    }),
    repositoryIntent: deepFreeze({
      createAllowed: params.createAllowed === true,
      updateAllowed: params.updateAllowed === true,
      requiresHumanApproval: params.requiresHumanApproval === true
    }),
    targetHints: params.targetHints,
    persistenceEnabled: false,
    executed: false,
    advisory: true,
    architectureOnly: true
  });
}

/**
 * @returns {Readonly<Object>}
 */
function buildSafeRepositoryContract() {
  const operation = RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS.REVIEW_REQUIRED;

  return buildRepositoryContractResult({
    operation,
    entity: resolveEntityForOperation(operation),
    lifecycleEvent: "UNKNOWN",
    proposalType: RECRUITMENT_DRAFT_PROPOSAL_TYPES.MANUAL_REVIEW,
    titleHint: null,
    sourceIdentifier: null,
    createAllowed: false,
    updateAllowed: false,
    requiresHumanApproval: true,
    targetHints: resolveTargetHints(
      RECRUITMENT_DRAFT_STORAGE_ACTIONS.HOLD_FOR_REVIEW,
      null
    )
  });
}

/**
 * @param {Readonly<Object>|null|undefined} context
 * @returns {Readonly<Object>|null}
 */
function resolveStoragePayload(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  if (isRecruitmentDraftStoragePayload(context.storagePayload)) {
    return context.storagePayload;
  }

  return null;
}

/**
 * Map a Phase 118 storage payload into a future repository contract.
 * Never throws. Never mutates input. Never queries databases or repositories.
 *
 * @param {Object|null|undefined} context
 * @returns {Readonly<Object>}
 */
function createRecruitmentDraftRepositoryContract(context) {
  try {
    const storagePayload = resolveStoragePayload(context);

    if (!storagePayload) {
      return buildSafeRepositoryContract();
    }

    const repositoryHints = isPlainObject(context) ? context.repositoryHints : null;
    const operation = resolveRepositoryOperation(storagePayload.storageAction);
    const repositoryIntent = resolveRepositoryIntent(
      operation,
      storagePayload.draftMetadata
    );

    return buildRepositoryContractResult({
      operation,
      entity: resolveEntityForOperation(operation),
      lifecycleEvent: storagePayload.lifecycleEvent,
      proposalType: storagePayload.proposalType,
      titleHint: storagePayload.titleHint,
      sourceIdentifier: storagePayload.sourceIdentifier,
      createAllowed: repositoryIntent.createAllowed,
      updateAllowed: repositoryIntent.updateAllowed,
      requiresHumanApproval: repositoryIntent.requiresHumanApproval,
      targetHints: resolveTargetHints(storagePayload.storageAction, repositoryHints)
    });
  } catch {
    return buildSafeRepositoryContract();
  }
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRecruitmentDraftRepositoryContract(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  const validOperations = Object.values(RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS);
  const validProposalTypes = Object.values(RECRUITMENT_DRAFT_PROPOSAL_TYPES);

  if (
    value.contractVersion !== RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_VERSION ||
    !validOperations.includes(value.operation)
  ) {
    return false;
  }

  const expectedEntity = resolveEntityForOperation(value.operation);
  if (value.entity !== expectedEntity) {
    return false;
  }

  if (!isPlainObject(value.draftMapping)) {
    return false;
  }

  const draftMapping = value.draftMapping;
  if (
    typeof draftMapping.lifecycleEvent !== "string" ||
    !validProposalTypes.includes(draftMapping.proposalType) ||
    (draftMapping.titleHint != null && typeof draftMapping.titleHint !== "string") ||
    (draftMapping.sourceIdentifier != null && typeof draftMapping.sourceIdentifier !== "string")
  ) {
    return false;
  }

  if (!isPlainObject(value.repositoryIntent)) {
    return false;
  }

  const repositoryIntent = value.repositoryIntent;
  if (
    typeof repositoryIntent.createAllowed !== "boolean" ||
    typeof repositoryIntent.updateAllowed !== "boolean" ||
    typeof repositoryIntent.requiresHumanApproval !== "boolean"
  ) {
    return false;
  }

  if (!isPlainObject(value.targetHints)) {
    return false;
  }

  const targetHints = value.targetHints;
  if (
    targetHints.primaryTable != null &&
    typeof targetHints.primaryTable !== "string"
  ) {
    return false;
  }

  if (!Array.isArray(targetHints.relatedTables)) {
    return false;
  }

  for (let i = 0; i < targetHints.relatedTables.length; i += 1) {
    if (typeof targetHints.relatedTables[i] !== "string") {
      return false;
    }
  }

  return (
    value.persistenceEnabled === false &&
    value.executed === false &&
    value.advisory === true &&
    value.architectureOnly === true
  );
}

/**
 * Summarize a recruitment draft repository contract result.
 *
 * @param {*} value
 * @returns {Readonly<Object>}
 */
function summarizeRecruitmentDraftRepositoryContract(value) {
  if (!isRecruitmentDraftRepositoryContract(value)) {
    return EMPTY_REPOSITORY_CONTRACT_SUMMARY;
  }

  return Object.freeze({
    operation: value.operation,
    entity: value.entity,
    lifecycleEvent: value.draftMapping.lifecycleEvent,
    proposalType: value.draftMapping.proposalType,
    createAllowed: value.repositoryIntent.createAllowed,
    updateAllowed: value.repositoryIntent.updateAllowed,
    requiresHumanApproval: value.repositoryIntent.requiresHumanApproval,
    primaryTable: value.targetHints.primaryTable
  });
}

module.exports = {
  RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_PHASE,
  RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_ENTITY,
  RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_VERSION,
  RECRUITMENT_DRAFT_REPOSITORY_OPERATIONS,
  RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_DESCRIPTOR,
  RECRUITMENT_DRAFT_REPOSITORY_CONTRACT_METADATA,
  DEFAULT_TARGET_PRIMARY_TABLE,
  DEFAULT_TARGET_RELATED_TABLES,
  EMPTY_REPOSITORY_CONTRACT_SUMMARY,
  createRecruitmentDraftRepositoryContract,
  isRecruitmentDraftRepositoryContract,
  summarizeRecruitmentDraftRepositoryContract
};
