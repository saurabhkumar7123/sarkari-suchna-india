"use strict";

/**
 * Phase 36 — MySQL Persistence Repository Adapters (architecture only).
 *
 * Thin adapters that satisfy Phase 35 repository contracts by delegating to
 * existing MySQL repository implementations. No SQL is duplicated here.
 *
 * Suitable for dependency injection. Not wired into workers, runtime
 * persistence policy/service, or automation. Runtime behavior remains unchanged.
 */

const {
  REPOSITORY_DOMAINS,
  assertRepositoryContract
} = require("./persistenceRepositoryContracts");

const ADAPTER_BACKEND = "mysql";

const ADAPTER_ERROR_CODES = Object.freeze({
  REPOSITORY_ADAPTER_ERROR: "REPOSITORY_ADAPTER_ERROR",
  REPOSITORY_ADAPTER_DELEGATE_MISSING: "REPOSITORY_ADAPTER_DELEGATE_MISSING"
});

const RESULT_KINDS = Object.freeze({
  BOOLEAN: "boolean",
  ENTITY: "entity",
  ARRAY: "array",
  LIST_PAGE: "list_page"
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Normalize boolean repository returns (tableExists, existsBy*).
 * @param {*} value
 * @returns {boolean}
 */
function normalizeBooleanResult(value) {
  return value === true;
}

/**
 * Normalize single-entity returns (create/get/update). Missing → null.
 * @param {*} value
 * @returns {Object|null}
 */
function normalizeEntityResult(value) {
  if (value == null) {
    return null;
  }
  return value;
}

/**
 * Normalize array returns (findCandidates*, findPending*).
 * @param {*} value
 * @returns {Object[]}
 */
function normalizeArrayResult(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Normalize paginated list returns ({ data, pagination }).
 * @param {*} value
 * @returns {{ data: Object[], pagination: { page: number, limit: number, total: number } }}
 */
function normalizeListPageResult(value) {
  const source = isPlainObject(value) ? value : {};
  const data = Array.isArray(source.data) ? source.data : [];
  const pagination = isPlainObject(source.pagination) ? source.pagination : {};
  const page = Number(pagination.page);
  const limit = Number(pagination.limit);
  const total = Number(pagination.total);

  return {
    data,
    pagination: {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit >= 0 ? limit : 0,
      total: Number.isFinite(total) && total >= 0 ? total : 0
    }
  };
}

/**
 * @param {*} value
 * @param {string} kind
 * @returns {*}
 */
function normalizeResult(value, kind) {
  switch (kind) {
    case RESULT_KINDS.BOOLEAN:
      return normalizeBooleanResult(value);
    case RESULT_KINDS.ENTITY:
      return normalizeEntityResult(value);
    case RESULT_KINDS.ARRAY:
      return normalizeArrayResult(value);
    case RESULT_KINDS.LIST_PAGE:
      return normalizeListPageResult(value);
    default:
      return value;
  }
}

/**
 * Wrap a thrown value into a stable adapter error shape.
 * @param {*} err
 * @param {{ domain: string, method: string }} ctx
 * @returns {Error}
 */
function normalizeAdapterError(err, ctx) {
  if (
    err != null &&
    typeof err === "object" &&
    (err.code === ADAPTER_ERROR_CODES.REPOSITORY_ADAPTER_ERROR ||
      err.code === ADAPTER_ERROR_CODES.REPOSITORY_ADAPTER_DELEGATE_MISSING)
  ) {
    return err;
  }

  const originalMessage =
    err && typeof err.message === "string" && err.message
      ? err.message
      : String(err);
  const error = new Error(
    `Repository adapter error (${ctx.domain}.${ctx.method}): ${originalMessage}`
  );
  error.code = ADAPTER_ERROR_CODES.REPOSITORY_ADAPTER_ERROR;
  error.domain = ctx.domain;
  error.method = ctx.method;
  error.backend = ADAPTER_BACKEND;
  error.cause = err;
  if (err != null && typeof err === "object" && err.code != null) {
    error.originalCode = err.code;
  }
  return error;
}

function missingDelegateError(domain, method) {
  const error = new Error(
    `Repository adapter delegate missing: ${domain}.${method}`
  );
  error.code = ADAPTER_ERROR_CODES.REPOSITORY_ADAPTER_DELEGATE_MISSING;
  error.domain = domain;
  error.method = method;
  error.backend = ADAPTER_BACKEND;
  return error;
}

/**
 * Bind a contract method to an underlying repository function with
 * result/error normalization. Never duplicates SQL.
 *
 * @param {string} domain
 * @param {string} method
 * @param {Function|undefined} delegate
 * @param {string} resultKind
 * @returns {Function}
 */
function bindDelegatedMethod(domain, method, delegate, resultKind) {
  return async function adaptedRepositoryMethod(...args) {
    if (typeof delegate !== "function") {
      throw missingDelegateError(domain, method);
    }
    try {
      const raw = await delegate(...args);
      return normalizeResult(raw, resultKind);
    } catch (err) {
      throw normalizeAdapterError(err, { domain, method });
    }
  };
}

function resolveDelegateBag(deps, key, defaultLoader) {
  if (deps != null && Object.prototype.hasOwnProperty.call(deps, key) && deps[key] != null) {
    return deps[key];
  }
  return defaultLoader();
}

function createMysqlRecruitmentRepository(deps = {}) {
  const domain = REPOSITORY_DOMAINS.RECRUITMENT;
  const repo = resolveDelegateBag(deps, "recruitmentRepository", () =>
    require("../../repositories/recruitment.repository")
  );

  const adapter = Object.freeze({
    tableExists: bindDelegatedMethod(
      domain,
      "tableExists",
      repo.tableExists,
      RESULT_KINDS.BOOLEAN
    ),
    createRecruitment: bindDelegatedMethod(
      domain,
      "createRecruitment",
      repo.createRecruitment,
      RESULT_KINDS.ENTITY
    ),
    getRecruitmentById: bindDelegatedMethod(
      domain,
      "getRecruitmentById",
      repo.getRecruitmentById,
      RESULT_KINDS.ENTITY
    ),
    getRecruitmentBySlug: bindDelegatedMethod(
      domain,
      "getRecruitmentBySlug",
      repo.getRecruitmentBySlug,
      RESULT_KINDS.ENTITY
    ),
    listRecruitments: bindDelegatedMethod(
      domain,
      "listRecruitments",
      repo.listRecruitments,
      RESULT_KINDS.LIST_PAGE
    ),
    updateRecruitment: bindDelegatedMethod(
      domain,
      "updateRecruitment",
      repo.updateRecruitment,
      RESULT_KINDS.ENTITY
    ),
    existsBySlug: bindDelegatedMethod(
      domain,
      "existsBySlug",
      repo.existsBySlug,
      RESULT_KINDS.BOOLEAN
    ),
    existsByAdvertisementNo: bindDelegatedMethod(
      domain,
      "existsByAdvertisementNo",
      repo.existsByAdvertisementNo,
      RESULT_KINDS.BOOLEAN
    ),
    findCandidatesForLookup: bindDelegatedMethod(
      domain,
      "findCandidatesForLookup",
      repo.findCandidatesForLookup,
      RESULT_KINDS.ARRAY
    ),
    findCandidatesByAdvertisementNoLoose: bindDelegatedMethod(
      domain,
      "findCandidatesByAdvertisementNoLoose",
      repo.findCandidatesByAdvertisementNoLoose,
      RESULT_KINDS.ARRAY
    )
  });

  assertRepositoryContract(domain, adapter);
  return adapter;
}

function createMysqlRecruitmentEventRepository(deps = {}) {
  const domain = REPOSITORY_DOMAINS.RECRUITMENT_EVENT;
  const repo = resolveDelegateBag(deps, "recruitmentEventRepository", () =>
    require("../../repositories/recruitmentEvent.repository")
  );

  const adapter = Object.freeze({
    tableExists: bindDelegatedMethod(
      domain,
      "tableExists",
      repo.tableExists,
      RESULT_KINDS.BOOLEAN
    ),
    createRecruitmentEvent: bindDelegatedMethod(
      domain,
      "createRecruitmentEvent",
      repo.createRecruitmentEvent,
      RESULT_KINDS.ENTITY
    ),
    getRecruitmentEventById: bindDelegatedMethod(
      domain,
      "getRecruitmentEventById",
      repo.getRecruitmentEventById,
      RESULT_KINDS.ENTITY
    ),
    listRecruitmentEventsByRecruitmentId: bindDelegatedMethod(
      domain,
      "listRecruitmentEventsByRecruitmentId",
      repo.listRecruitmentEventsByRecruitmentId,
      RESULT_KINDS.LIST_PAGE
    ),
    updateRecruitmentEvent: bindDelegatedMethod(
      domain,
      "updateRecruitmentEvent",
      repo.updateRecruitmentEvent,
      RESULT_KINDS.ENTITY
    )
  });

  assertRepositoryContract(domain, adapter);
  return adapter;
}

function createMysqlReviewRepository(deps = {}) {
  const domain = REPOSITORY_DOMAINS.REVIEW;
  const repo = resolveDelegateBag(deps, "reviewRepository", () =>
    require("../../repositories/recruitmentReview.repository")
  );

  // Contract names → existing editorial repository method names.
  const adapter = Object.freeze({
    tableExists: bindDelegatedMethod(
      domain,
      "tableExists",
      repo.tableExists,
      RESULT_KINDS.BOOLEAN
    ),
    createReviewItem: bindDelegatedMethod(
      domain,
      "createReviewItem",
      repo.create,
      RESULT_KINDS.ENTITY
    ),
    getReviewItemById: bindDelegatedMethod(
      domain,
      "getReviewItemById",
      repo.findById,
      RESULT_KINDS.ENTITY
    ),
    findPendingReviewItems: bindDelegatedMethod(
      domain,
      "findPendingReviewItems",
      repo.findPending,
      RESULT_KINDS.ARRAY
    ),
    listReviewItems: bindDelegatedMethod(
      domain,
      "listReviewItems",
      repo.list,
      RESULT_KINDS.LIST_PAGE
    ),
    updateReviewDecision: bindDelegatedMethod(
      domain,
      "updateReviewDecision",
      repo.updateDecision,
      RESULT_KINDS.ENTITY
    )
  });

  assertRepositoryContract(domain, adapter);
  return adapter;
}

/**
 * Build a DI-ready bag of MySQL-backed repository adapters for all domains.
 *
 * @param {{
 *   recruitmentRepository?: Object,
 *   recruitmentEventRepository?: Object,
 *   reviewRepository?: Object
 * }} [deps]
 * @returns {{
 *   recruitment: Object,
 *   recruitmentEvent: Object,
 *   review: Object
 * }}
 */
function createMysqlPersistenceRepositories(deps = {}) {
  return Object.freeze({
    recruitment: createMysqlRecruitmentRepository(deps),
    recruitmentEvent: createMysqlRecruitmentEventRepository(deps),
    review: createMysqlReviewRepository(deps)
  });
}

module.exports = {
  ADAPTER_BACKEND,
  ADAPTER_ERROR_CODES,
  RESULT_KINDS,
  normalizeBooleanResult,
  normalizeEntityResult,
  normalizeArrayResult,
  normalizeListPageResult,
  normalizeResult,
  normalizeAdapterError,
  createMysqlRecruitmentRepository,
  createMysqlRecruitmentEventRepository,
  createMysqlReviewRepository,
  createMysqlPersistenceRepositories
};
