"use strict";

/**
 * Phase 35 — Persistence Repository Contracts (architecture only).
 *
 * Defines implementation-independent repository surfaces for future
 * Recruitment Lifecycle persistence adapters. These contracts describe
 * required methods and validation helpers for dependency injection.
 *
 * Never accesses databases. Never writes SQL. Never imports concrete
 * repositories, database drivers, Express, workers, or filesystem APIs.
 * No persistence is enabled by this module.
 */

const CONTRACT_NOT_IMPLEMENTED = "CONTRACT_NOT_IMPLEMENTED";

const REPOSITORY_DOMAINS = Object.freeze({
  RECRUITMENT: "recruitment",
  RECRUITMENT_EVENT: "recruitment_event",
  REVIEW: "review"
});

/**
 * Required methods for a Recruitment repository adapter.
 * Intent: create/read/update recruitments and identity lookups.
 */
const RECRUITMENT_REPOSITORY_METHODS = Object.freeze([
  "tableExists",
  "createRecruitment",
  "getRecruitmentById",
  "getRecruitmentBySlug",
  "listRecruitments",
  "updateRecruitment",
  "existsBySlug",
  "existsByAdvertisementNo",
  "findCandidatesForLookup",
  "findCandidatesByAdvertisementNoLoose"
]);

/**
 * Required methods for a Recruitment Event repository adapter.
 * Intent: create/read/update lifecycle events bound to a recruitment.
 */
const RECRUITMENT_EVENT_REPOSITORY_METHODS = Object.freeze([
  "tableExists",
  "createRecruitmentEvent",
  "getRecruitmentEventById",
  "listRecruitmentEventsByRecruitmentId",
  "updateRecruitmentEvent"
]);

/**
 * Required methods for a Review repository adapter.
 * Intent: enqueue, query, and decide review-queue items.
 */
const REVIEW_REPOSITORY_METHODS = Object.freeze([
  "tableExists",
  "createReviewItem",
  "getReviewItemById",
  "findPendingReviewItems",
  "listReviewItems",
  "updateReviewDecision"
]);

/**
 * @typedef {Object} RecruitmentRepositoryContract
 * @property {() => Promise<boolean>} tableExists
 * @property {(row: Object) => Promise<Object|null>} createRecruitment
 * @property {(id: number|string) => Promise<Object|null>} getRecruitmentById
 * @property {(slug: string) => Promise<Object|null>} getRecruitmentBySlug
 * @property {(opts?: Object) => Promise<Object>} listRecruitments
 * @property {(id: number|string, row: Object) => Promise<Object|null>} updateRecruitment
 * @property {(slug: string, excludeId?: number|string|null) => Promise<boolean>} existsBySlug
 * @property {(advertisementNo: string, excludeId?: number|string|null) => Promise<boolean>} existsByAdvertisementNo
 * @property {(filters?: Object) => Promise<Object[]>} findCandidatesForLookup
 * @property {(advertisementNo: string, limit?: number) => Promise<Object[]>} findCandidatesByAdvertisementNoLoose
 */

/**
 * @typedef {Object} RecruitmentEventRepositoryContract
 * @property {() => Promise<boolean>} tableExists
 * @property {(row: Object) => Promise<Object|null>} createRecruitmentEvent
 * @property {(id: number|string) => Promise<Object|null>} getRecruitmentEventById
 * @property {(opts?: Object) => Promise<Object>} listRecruitmentEventsByRecruitmentId
 * @property {(id: number|string, row: Object) => Promise<Object|null>} updateRecruitmentEvent
 */

/**
 * @typedef {Object} ReviewRepositoryContract
 * @property {() => Promise<boolean>} tableExists
 * @property {(row: Object) => Promise<Object|null>} createReviewItem
 * @property {(id: number|string) => Promise<Object|null>} getReviewItemById
 * @property {(opts?: Object) => Promise<Object[]>} findPendingReviewItems
 * @property {(opts?: Object) => Promise<Object>} listReviewItems
 * @property {(id: number|string, patch?: Object) => Promise<Object|null>} updateReviewDecision
 */

/**
 * @typedef {Object} RepositoryContractDescriptor
 * @property {string} domain
 * @property {readonly string[]} methods
 * @property {string} description
 */

/**
 * @typedef {Object} RepositoryContractValidationResult
 * @property {boolean} valid
 * @property {string|null} domain
 * @property {string[]} missingMethods
 * @property {string[]} nonFunctionMethods
 * @property {boolean} architectureOnly
 * @property {boolean} sideEffects
 */

const REPOSITORY_CONTRACTS = Object.freeze({
  [REPOSITORY_DOMAINS.RECRUITMENT]: Object.freeze({
    domain: REPOSITORY_DOMAINS.RECRUITMENT,
    methods: RECRUITMENT_REPOSITORY_METHODS,
    description:
      "Persistence contract for recruitment entity create/read/update and lookup."
  }),
  [REPOSITORY_DOMAINS.RECRUITMENT_EVENT]: Object.freeze({
    domain: REPOSITORY_DOMAINS.RECRUITMENT_EVENT,
    methods: RECRUITMENT_EVENT_REPOSITORY_METHODS,
    description:
      "Persistence contract for recruitment lifecycle event create/read/update."
  }),
  [REPOSITORY_DOMAINS.REVIEW]: Object.freeze({
    domain: REPOSITORY_DOMAINS.REVIEW,
    methods: REVIEW_REPOSITORY_METHODS,
    description:
      "Persistence contract for review-queue item create/query/decision updates."
  })
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function normalizeDomain(domain) {
  if (domain == null || domain === "") {
    return null;
  }
  const normalized = String(domain).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(REPOSITORY_CONTRACTS, normalized)
    ? normalized
    : null;
}

/**
 * List all repository domain identifiers (sorted for determinism).
 * @returns {string[]}
 */
function listRepositoryDomains() {
  return Object.values(REPOSITORY_DOMAINS).slice().sort();
}

/**
 * @param {string} domain
 * @returns {RepositoryContractDescriptor|null}
 */
function getRepositoryContract(domain) {
  const key = normalizeDomain(domain);
  if (key == null) {
    return null;
  }
  const contract = REPOSITORY_CONTRACTS[key];
  return Object.freeze({
    domain: contract.domain,
    methods: contract.methods.slice(),
    description: contract.description
  });
}

/**
 * @param {string} domain
 * @returns {string[]}
 */
function getRequiredMethods(domain) {
  const contract = getRepositoryContract(domain);
  return contract ? contract.methods.slice() : [];
}

/**
 * Validate that a candidate object exposes the required contract methods.
 * Pure: never invokes candidate methods; never performs I/O.
 *
 * @param {string} domain
 * @param {Object|null|undefined} candidate
 * @returns {RepositoryContractValidationResult}
 */
function validateRepositoryContract(domain, candidate) {
  const key = normalizeDomain(domain);
  if (key == null) {
    return {
      valid: false,
      domain: null,
      missingMethods: [],
      nonFunctionMethods: [],
      architectureOnly: true,
      sideEffects: false
    };
  }

  const required = REPOSITORY_CONTRACTS[key].methods;
  const missingMethods = [];
  const nonFunctionMethods = [];

  if (!isPlainObject(candidate)) {
    return {
      valid: false,
      domain: key,
      missingMethods: required.slice(),
      nonFunctionMethods: [],
      architectureOnly: true,
      sideEffects: false
    };
  }

  for (let i = 0; i < required.length; i += 1) {
    const methodName = required[i];
    if (!Object.prototype.hasOwnProperty.call(candidate, methodName)) {
      missingMethods.push(methodName);
      continue;
    }
    if (typeof candidate[methodName] !== "function") {
      nonFunctionMethods.push(methodName);
    }
  }

  return {
    valid: missingMethods.length === 0 && nonFunctionMethods.length === 0,
    domain: key,
    missingMethods,
    nonFunctionMethods,
    architectureOnly: true,
    sideEffects: false
  };
}

/**
 * @param {string} domain
 * @param {Object|null|undefined} candidate
 * @returns {boolean}
 */
function implementsRepositoryContract(domain, candidate) {
  return validateRepositoryContract(domain, candidate).valid === true;
}

/**
 * @param {string} domain
 * @param {Object|null|undefined} candidate
 * @returns {RepositoryContractValidationResult}
 */
function assertRepositoryContract(domain, candidate) {
  const result = validateRepositoryContract(domain, candidate);
  if (!result.valid) {
    const parts = [];
    if (result.domain == null) {
      parts.push(`unknown repository domain: ${String(domain)}`);
    } else {
      if (result.missingMethods.length > 0) {
        parts.push(`missing methods: ${result.missingMethods.join(", ")}`);
      }
      if (result.nonFunctionMethods.length > 0) {
        parts.push(
          `non-function methods: ${result.nonFunctionMethods.join(", ")}`
        );
      }
    }
    const error = new Error(
      `Repository contract assertion failed (${String(domain)}): ${parts.join("; ")}`
    );
    error.code = CONTRACT_NOT_IMPLEMENTED;
    error.validation = result;
    throw error;
  }
  return result;
}

function buildUnimplementedMethod(domain, methodName) {
  return function unimplementedRepositoryMethod() {
    const error = new Error(
      `Repository method not implemented: ${domain}.${methodName}`
    );
    error.code = CONTRACT_NOT_IMPLEMENTED;
    error.domain = domain;
    error.method = methodName;
    error.architectureOnly = true;
    throw error;
  };
}

/**
 * Build a DI-ready stub that implements the contract surface by throwing
 * CONTRACT_NOT_IMPLEMENTED on every method call. No I/O; no persistence.
 *
 * @param {string} domain
 * @returns {Object}
 */
function createUnimplementedRepository(domain) {
  const key = normalizeDomain(domain);
  if (key == null) {
    const error = new Error(
      `Unknown repository domain: ${String(domain)}`
    );
    error.code = CONTRACT_NOT_IMPLEMENTED;
    throw error;
  }

  const methods = REPOSITORY_CONTRACTS[key].methods;
  const stub = Object.create(null);
  for (let i = 0; i < methods.length; i += 1) {
    const methodName = methods[i];
    stub[methodName] = buildUnimplementedMethod(key, methodName);
  }
  return Object.freeze(stub);
}

/**
 * @returns {{
 *   recruitment: Object,
 *   recruitmentEvent: Object,
 *   review: Object
 * }}
 */
function createAllUnimplementedRepositories() {
  return Object.freeze({
    recruitment: createUnimplementedRepository(REPOSITORY_DOMAINS.RECRUITMENT),
    recruitmentEvent: createUnimplementedRepository(
      REPOSITORY_DOMAINS.RECRUITMENT_EVENT
    ),
    review: createUnimplementedRepository(REPOSITORY_DOMAINS.REVIEW)
  });
}

module.exports = {
  CONTRACT_NOT_IMPLEMENTED,
  REPOSITORY_DOMAINS,
  RECRUITMENT_REPOSITORY_METHODS,
  RECRUITMENT_EVENT_REPOSITORY_METHODS,
  REVIEW_REPOSITORY_METHODS,
  REPOSITORY_CONTRACTS,
  listRepositoryDomains,
  getRepositoryContract,
  getRequiredMethods,
  validateRepositoryContract,
  implementsRepositoryContract,
  assertRepositoryContract,
  createUnimplementedRepository,
  createAllUnimplementedRepositories
};
