"use strict";

/**
 * Phase 36 — MySQL Persistence Repository Adapters tests.
 * Architecture only: adapters, delegation, normalization, boundaries — no runtime wiring.
 */

const fs = require("fs");
const path = require("path");

const {
  REPOSITORY_DOMAINS,
  RECRUITMENT_REPOSITORY_METHODS,
  RECRUITMENT_EVENT_REPOSITORY_METHODS,
  REVIEW_REPOSITORY_METHODS,
  implementsRepositoryContract,
  assertRepositoryContract,
  validateRepositoryContract
} = require("../server/lib/recruitment/persistenceRepositoryContracts");

const {
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
} = require("../server/lib/recruitment/mysqlPersistenceRepositoryAdapters");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function createMockRecruitmentRepo(overrides = {}) {
  return {
    tableExists: jest.fn(async () => true),
    createRecruitment: jest.fn(async (row) => ({ id: 1, ...row })),
    getRecruitmentById: jest.fn(async (id) => ({ id })),
    getRecruitmentBySlug: jest.fn(async (slug) => ({ id: 2, slug })),
    listRecruitments: jest.fn(async () => ({
      data: [{ id: 1 }],
      pagination: { page: 1, limit: 20, total: 1 }
    })),
    updateRecruitment: jest.fn(async (id, row) => ({ id, ...row })),
    existsBySlug: jest.fn(async () => true),
    existsByAdvertisementNo: jest.fn(async () => false),
    findCandidatesForLookup: jest.fn(async () => [{ id: 3 }]),
    findCandidatesByAdvertisementNoLoose: jest.fn(async () => [{ id: 4 }]),
    ...overrides
  };
}

function createMockEventRepo(overrides = {}) {
  return {
    tableExists: jest.fn(async () => true),
    createRecruitmentEvent: jest.fn(async (row) => ({ id: 10, ...row })),
    getRecruitmentEventById: jest.fn(async (id) => ({ id })),
    listRecruitmentEventsByRecruitmentId: jest.fn(async () => ({
      data: [{ id: 10 }],
      pagination: { page: 1, limit: 20, total: 1 }
    })),
    updateRecruitmentEvent: jest.fn(async (id, row) => ({ id, ...row })),
    ...overrides
  };
}

function createMockReviewRepo(overrides = {}) {
  return {
    tableExists: jest.fn(async () => true),
    create: jest.fn(async (row) => ({ id: 20, status: "pending", ...row })),
    findById: jest.fn(async (id) => ({ id, status: "pending" })),
    findPending: jest.fn(async () => [{ id: 20, status: "pending" }]),
    list: jest.fn(async () => ({
      data: [{ id: 20 }],
      pagination: { page: 1, limit: 20, total: 1 }
    })),
    updateDecision: jest.fn(async (id, patch) => ({ id, ...patch })),
    ...overrides
  };
}

describe("Phase 36 — mysqlPersistenceRepositoryAdapters", () => {
  describe("constants", () => {
    test("exposes frozen backend and error codes", () => {
      expect(ADAPTER_BACKEND).toBe("mysql");
      expect(ADAPTER_ERROR_CODES).toEqual({
        REPOSITORY_ADAPTER_ERROR: "REPOSITORY_ADAPTER_ERROR",
        REPOSITORY_ADAPTER_DELEGATE_MISSING: "REPOSITORY_ADAPTER_DELEGATE_MISSING"
      });
      expect(Object.isFrozen(ADAPTER_ERROR_CODES)).toBe(true);
      expect(Object.isFrozen(RESULT_KINDS)).toBe(true);
    });
  });

  describe("contract compliance", () => {
    test("recruitment adapter implements RecruitmentRepositoryContract", () => {
      const adapter = createMysqlRecruitmentRepository({
        recruitmentRepository: createMockRecruitmentRepo()
      });
      expect(
        implementsRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT, adapter)
      ).toBe(true);
      expect(
        assertRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT, adapter)
      ).toEqual(
        expect.objectContaining({
          valid: true,
          domain: REPOSITORY_DOMAINS.RECRUITMENT,
          missingMethods: [],
          nonFunctionMethods: []
        })
      );
      expect(Object.isFrozen(adapter)).toBe(true);
      for (const method of RECRUITMENT_REPOSITORY_METHODS) {
        expect(typeof adapter[method]).toBe("function");
      }
    });

    test("recruitment event adapter implements RecruitmentEventRepositoryContract", () => {
      const adapter = createMysqlRecruitmentEventRepository({
        recruitmentEventRepository: createMockEventRepo()
      });
      expect(
        implementsRepositoryContract(
          REPOSITORY_DOMAINS.RECRUITMENT_EVENT,
          adapter
        )
      ).toBe(true);
      expect(Object.isFrozen(adapter)).toBe(true);
      for (const method of RECRUITMENT_EVENT_REPOSITORY_METHODS) {
        expect(typeof adapter[method]).toBe("function");
      }
    });

    test("review adapter implements ReviewRepositoryContract", () => {
      const adapter = createMysqlReviewRepository({
        reviewRepository: createMockReviewRepo()
      });
      expect(
        implementsRepositoryContract(REPOSITORY_DOMAINS.REVIEW, adapter)
      ).toBe(true);
      expect(Object.isFrozen(adapter)).toBe(true);
      for (const method of REVIEW_REPOSITORY_METHODS) {
        expect(typeof adapter[method]).toBe("function");
      }
    });

    test("createMysqlPersistenceRepositories bag satisfies all domain contracts", () => {
      const bag = createMysqlPersistenceRepositories({
        recruitmentRepository: createMockRecruitmentRepo(),
        recruitmentEventRepository: createMockEventRepo(),
        reviewRepository: createMockReviewRepo()
      });
      expect(Object.isFrozen(bag)).toBe(true);
      expect(Object.keys(bag).sort()).toEqual([
        "recruitment",
        "recruitmentEvent",
        "review"
      ]);
      expect(
        implementsRepositoryContract(
          REPOSITORY_DOMAINS.RECRUITMENT,
          bag.recruitment
        )
      ).toBe(true);
      expect(
        implementsRepositoryContract(
          REPOSITORY_DOMAINS.RECRUITMENT_EVENT,
          bag.recruitmentEvent
        )
      ).toBe(true);
      expect(
        implementsRepositoryContract(REPOSITORY_DOMAINS.REVIEW, bag.review)
      ).toBe(true);
    });
  });

  describe("method delegation", () => {
    test("recruitment methods forward arguments to existing repository", async () => {
      const repo = createMockRecruitmentRepo();
      const adapter = createMysqlRecruitmentRepository({
        recruitmentRepository: repo
      });

      await adapter.tableExists();
      await adapter.createRecruitment({ title: "T", slug: "t" });
      await adapter.getRecruitmentById(7);
      await adapter.getRecruitmentBySlug("abc");
      await adapter.listRecruitments({ page: 2 });
      await adapter.updateRecruitment(7, { title: "U" });
      await adapter.existsBySlug("abc", 9);
      await adapter.existsByAdvertisementNo("ADV-1", null);
      await adapter.findCandidatesForLookup({ department: "SSC" });
      await adapter.findCandidatesByAdvertisementNoLoose("ADV", 5);

      expect(repo.tableExists).toHaveBeenCalledTimes(1);
      expect(repo.createRecruitment).toHaveBeenCalledWith({
        title: "T",
        slug: "t"
      });
      expect(repo.getRecruitmentById).toHaveBeenCalledWith(7);
      expect(repo.getRecruitmentBySlug).toHaveBeenCalledWith("abc");
      expect(repo.listRecruitments).toHaveBeenCalledWith({ page: 2 });
      expect(repo.updateRecruitment).toHaveBeenCalledWith(7, { title: "U" });
      expect(repo.existsBySlug).toHaveBeenCalledWith("abc", 9);
      expect(repo.existsByAdvertisementNo).toHaveBeenCalledWith("ADV-1", null);
      expect(repo.findCandidatesForLookup).toHaveBeenCalledWith({
        department: "SSC"
      });
      expect(repo.findCandidatesByAdvertisementNoLoose).toHaveBeenCalledWith(
        "ADV",
        5
      );
    });

    test("recruitment event methods forward arguments to existing repository", async () => {
      const repo = createMockEventRepo();
      const adapter = createMysqlRecruitmentEventRepository({
        recruitmentEventRepository: repo
      });

      await adapter.createRecruitmentEvent({
        recruitment_id: 1,
        event_type: "admit_card"
      });
      await adapter.getRecruitmentEventById(11);
      await adapter.listRecruitmentEventsByRecruitmentId({
        recruitment_id: 1
      });
      await adapter.updateRecruitmentEvent(11, { status: "published" });

      expect(repo.createRecruitmentEvent).toHaveBeenCalledWith({
        recruitment_id: 1,
        event_type: "admit_card"
      });
      expect(repo.getRecruitmentEventById).toHaveBeenCalledWith(11);
      expect(repo.listRecruitmentEventsByRecruitmentId).toHaveBeenCalledWith({
        recruitment_id: 1
      });
      expect(repo.updateRecruitmentEvent).toHaveBeenCalledWith(11, {
        status: "published"
      });
    });

    test("review methods map contract names to existing repository methods", async () => {
      const repo = createMockReviewRepo();
      const adapter = createMysqlReviewRepository({
        reviewRepository: repo
      });

      await adapter.createReviewItem({ title: "R", event_type: "result" });
      await adapter.getReviewItemById(20);
      await adapter.findPendingReviewItems({ limit: 10 });
      await adapter.listReviewItems({ status: "pending" });
      await adapter.updateReviewDecision(20, {
        decision: "approve",
        status: "resolved"
      });

      expect(repo.create).toHaveBeenCalledWith({
        title: "R",
        event_type: "result"
      });
      expect(repo.findById).toHaveBeenCalledWith(20);
      expect(repo.findPending).toHaveBeenCalledWith({ limit: 10 });
      expect(repo.list).toHaveBeenCalledWith({ status: "pending" });
      expect(repo.updateDecision).toHaveBeenCalledWith(20, {
        decision: "approve",
        status: "resolved"
      });

      expect(adapter.create).toBeUndefined();
      expect(adapter.findById).toBeUndefined();
      expect(adapter.findPending).toBeUndefined();
      expect(adapter.list).toBeUndefined();
      expect(adapter.updateDecision).toBeUndefined();
    });
  });

  describe("result normalization", () => {
    test("normalize helpers coerce entity / boolean / array / list_page shapes", () => {
      expect(normalizeBooleanResult(true)).toBe(true);
      expect(normalizeBooleanResult(1)).toBe(false);
      expect(normalizeBooleanResult(null)).toBe(false);

      expect(normalizeEntityResult(undefined)).toBeNull();
      expect(normalizeEntityResult(null)).toBeNull();
      expect(normalizeEntityResult({ id: 1 })).toEqual({ id: 1 });

      expect(normalizeArrayResult(null)).toEqual([]);
      expect(normalizeArrayResult({ id: 1 })).toEqual([]);
      expect(normalizeArrayResult([{ id: 1 }])).toEqual([{ id: 1 }]);

      expect(normalizeListPageResult(null)).toEqual({
        data: [],
        pagination: { page: 1, limit: 0, total: 0 }
      });
      expect(
        normalizeListPageResult({
          data: "bad",
          pagination: { page: "2", limit: "10", total: "3" }
        })
      ).toEqual({
        data: [],
        pagination: { page: 2, limit: 10, total: 3 }
      });

      expect(normalizeResult([{ a: 1 }], RESULT_KINDS.ARRAY)).toEqual([
        { a: 1 }
      ]);
    });

    test("recruitment adapter normalizes undefined entity and non-array candidates", async () => {
      const repo = createMockRecruitmentRepo({
        getRecruitmentById: jest.fn(async () => undefined),
        findCandidatesForLookup: jest.fn(async () => null),
        existsBySlug: jest.fn(async () => 1)
      });
      const adapter = createMysqlRecruitmentRepository({
        recruitmentRepository: repo
      });

      await expect(adapter.getRecruitmentById(1)).resolves.toBeNull();
      await expect(adapter.findCandidatesForLookup({})).resolves.toEqual([]);
      await expect(adapter.existsBySlug("x")).resolves.toBe(false);
    });

    test("list methods normalize incomplete list_page payloads", async () => {
      const recruitmentRepo = createMockRecruitmentRepo({
        listRecruitments: jest.fn(async () => ({ data: null }))
      });
      const eventRepo = createMockEventRepo({
        listRecruitmentEventsByRecruitmentId: jest.fn(async () => null)
      });
      const reviewRepo = createMockReviewRepo({
        list: jest.fn(async () => ({
          data: [{ id: 1 }],
          pagination: { page: 0, limit: -1, total: Number.NaN }
        }))
      });

      const recruitment = createMysqlRecruitmentRepository({
        recruitmentRepository: recruitmentRepo
      });
      const event = createMysqlRecruitmentEventRepository({
        recruitmentEventRepository: eventRepo
      });
      const review = createMysqlReviewRepository({
        reviewRepository: reviewRepo
      });

      await expect(recruitment.listRecruitments({})).resolves.toEqual({
        data: [],
        pagination: { page: 1, limit: 0, total: 0 }
      });
      await expect(
        event.listRecruitmentEventsByRecruitmentId({ recruitment_id: 1 })
      ).resolves.toEqual({
        data: [],
        pagination: { page: 1, limit: 0, total: 0 }
      });
      await expect(review.listReviewItems({})).resolves.toEqual({
        data: [{ id: 1 }],
        pagination: { page: 1, limit: 0, total: 0 }
      });
    });
  });

  describe("error normalization", () => {
    test("normalizeAdapterError wraps underlying errors with stable codes", () => {
      const original = new Error("boom");
      original.code = "ER_BAD_FIELD";
      const wrapped = normalizeAdapterError(original, {
        domain: REPOSITORY_DOMAINS.RECRUITMENT,
        method: "createRecruitment"
      });
      expect(wrapped.code).toBe(
        ADAPTER_ERROR_CODES.REPOSITORY_ADAPTER_ERROR
      );
      expect(wrapped.domain).toBe(REPOSITORY_DOMAINS.RECRUITMENT);
      expect(wrapped.method).toBe("createRecruitment");
      expect(wrapped.backend).toBe(ADAPTER_BACKEND);
      expect(wrapped.cause).toBe(original);
      expect(wrapped.originalCode).toBe("ER_BAD_FIELD");
      expect(wrapped.message).toMatch(/createRecruitment/);
      expect(wrapped.message).toMatch(/boom/);
    });

    test("adapter methods wrap delegate rejections", async () => {
      const repo = createMockRecruitmentRepo({
        getRecruitmentById: jest.fn(async () => {
          const err = new Error("db down");
          err.code = "ECONNREFUSED";
          throw err;
        })
      });
      const adapter = createMysqlRecruitmentRepository({
        recruitmentRepository: repo
      });

      await expect(adapter.getRecruitmentById(1)).rejects.toMatchObject({
        code: ADAPTER_ERROR_CODES.REPOSITORY_ADAPTER_ERROR,
        domain: REPOSITORY_DOMAINS.RECRUITMENT,
        method: "getRecruitmentById",
        backend: ADAPTER_BACKEND,
        originalCode: "ECONNREFUSED"
      });
    });

    test("missing delegate method throws REPOSITORY_ADAPTER_DELEGATE_MISSING", async () => {
      const adapter = createMysqlReviewRepository({
        reviewRepository: {
          tableExists: async () => true
          // remaining methods intentionally absent
        }
      });

      await expect(adapter.createReviewItem({ title: "x" })).rejects.toMatchObject({
        code: ADAPTER_ERROR_CODES.REPOSITORY_ADAPTER_DELEGATE_MISSING,
        domain: REPOSITORY_DOMAINS.REVIEW,
        method: "createReviewItem",
        backend: ADAPTER_BACKEND
      });
    });

    test("already-normalized adapter errors are not double-wrapped", () => {
      const existing = normalizeAdapterError(new Error("once"), {
        domain: REPOSITORY_DOMAINS.REVIEW,
        method: "listReviewItems"
      });
      const again = normalizeAdapterError(existing, {
        domain: REPOSITORY_DOMAINS.REVIEW,
        method: "listReviewItems"
      });
      expect(again).toBe(existing);
    });
  });

  describe("deterministic behavior", () => {
    test("identical list_page inputs yield identical normalized outputs", () => {
      const input = {
        data: [{ id: 1 }],
        pagination: { page: 1, limit: 20, total: 1 }
      };
      expect(normalizeListPageResult(input)).toEqual(
        normalizeListPageResult(input)
      );
    });

    test("validation of adapters does not invoke delegated methods", () => {
      const repo = createMockRecruitmentRepo();
      const adapter = createMysqlRecruitmentRepository({
        recruitmentRepository: repo
      });
      jest.clearAllMocks();
      expect(
        validateRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT, adapter)
          .valid
      ).toBe(true);
      for (const method of RECRUITMENT_REPOSITORY_METHODS) {
        expect(repo[method]).not.toHaveBeenCalled();
      }
    });

    test("repeated factory construction with same mocks yields equivalent contract surface", () => {
      const deps = {
        recruitmentRepository: createMockRecruitmentRepo(),
        recruitmentEventRepository: createMockEventRepo(),
        reviewRepository: createMockReviewRepo()
      };
      const a = createMysqlPersistenceRepositories(deps);
      const b = createMysqlPersistenceRepositories(deps);
      expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
      expect(
        validateRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT, a.recruitment)
      ).toEqual(
        validateRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT, b.recruitment)
      );
    });
  });

  describe("architecture boundaries (source)", () => {
    test("adapter module has no SQL and does not touch Express / workers / queues", () => {
      const source = read(
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js"
      );
      expect(source).toMatch(/Phase 36/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/No SQL is duplicated/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
      expect(source).not.toMatch(/\bSELECT\s+.+\s+FROM\b/i);
      expect(source).not.toMatch(/information_schema/i);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/siteWorker/);
      expect(source).not.toMatch(/runtimePersistencePolicy/);
      expect(source).not.toMatch(/runtimePersistenceService/);
    });

    test("adapter module only depends on contracts plus lazy repository requires", () => {
      const source = read(
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js"
      );
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([
        "./persistenceRepositoryContracts",
        "../../repositories/recruitment.repository",
        "../../repositories/recruitmentEvent.repository",
        "../../repositories/recruitmentReview.repository"
      ]);
    });

    test("siteWorker / runtime policy / runtime service remain unwired to adapters", () => {
      const worker = read("server/services/workers/siteWorker.js");
      const service = read(
        "server/lib/recruitment/runtimePersistenceService.js"
      );
      const policy = read(
        "server/lib/recruitment/runtimePersistencePolicy.js"
      );
      expect(worker).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(worker).not.toMatch(/createMysqlPersistenceRepositories/);
      expect(worker).not.toMatch(/createMysqlRecruitmentRepository/);
      expect(service).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(policy).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(service).toMatch(/EXECUTION_NOT_IMPLEMENTED/);
      expect(worker).toMatch(/Never persists review items/);
    });

    test("preview buffer and review service do not import adapters", () => {
      const preview = read("server/lib/recruitment/runtimePreviewBuffer.js");
      const reviewService = read(
        "server/services/recruitmentReview.service.js"
      );
      expect(preview).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(reviewService).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(reviewService).not.toMatch(/createMysqlReviewRepository/);
    });

    test("contracts, policy, and runtime service modules are unchanged by this phase", () => {
      const contracts = read(
        "server/lib/recruitment/persistenceRepositoryContracts.js"
      );
      const policy = read(
        "server/lib/recruitment/runtimePersistencePolicy.js"
      );
      const service = read(
        "server/lib/recruitment/runtimePersistenceService.js"
      );
      expect(contracts).toMatch(/Phase 35/);
      expect(contracts).not.toMatch(/Phase 36/);
      expect(policy).toMatch(/Phase 33/);
      expect(policy).not.toMatch(/Phase 36/);
      expect(service).toMatch(/Phase 34/);
      expect(service).not.toMatch(/Phase 36/);
    });

    test("concrete MySQL repositories are not modified and remain SQL owners", () => {
      const recruitment = read("server/repositories/recruitment.repository.js");
      const event = read(
        "server/repositories/recruitmentEvent.repository.js"
      );
      const review = read(
        "server/repositories/recruitmentReview.repository.js"
      );
      expect(recruitment).toMatch(/require\(["']\.\.\/config\/db["']\)/);
      expect(event).toMatch(/require\(["']\.\.\/config\/db["']\)/);
      expect(review).toMatch(/require\(["']\.\.\/config\/db["']\)/);
      expect(recruitment).not.toMatch(/Phase 36/);
      expect(event).not.toMatch(/Phase 36/);
      expect(review).not.toMatch(/Phase 36/);
      expect(recruitment).toMatch(/createRecruitment/);
      expect(review).toMatch(/async function create\(/);
      expect(review).toMatch(/async function findById\(/);
      expect(review).toMatch(/async function findPending\(/);
      expect(review).toMatch(/async function updateDecision\(/);
    });

    test("no runtime persistence enablement flags appear in adapter module", () => {
      const source = read(
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js"
      );
      expect(source).not.toMatch(/automaticPersistenceEnabled/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled/);
      expect(source).not.toMatch(/AUTOMATION_DISABLED/);
      expect(source).toMatch(/Runtime behavior remains unchanged/);
    });
  });
});
