"use strict";

/**
 * Phase 35 — Persistence Repository Contracts tests.
 * Architecture only: contracts, validation, and boundaries — no DB.
 */

const fs = require("fs");
const path = require("path");

const {
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
} = require("../server/lib/recruitment/persistenceRepositoryContracts");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function buildStubFromMethods(methods, impl) {
  const stub = {};
  for (let i = 0; i < methods.length; i += 1) {
    stub[methods[i]] = impl || (() => undefined);
  }
  return stub;
}

describe("Phase 35 — persistenceRepositoryContracts", () => {
  describe("constants", () => {
    test("exposes frozen repository domains", () => {
      expect(REPOSITORY_DOMAINS).toEqual({
        RECRUITMENT: "recruitment",
        RECRUITMENT_EVENT: "recruitment_event",
        REVIEW: "review"
      });
      expect(Object.isFrozen(REPOSITORY_DOMAINS)).toBe(true);
    });

    test("exposes frozen required method lists", () => {
      expect(Object.isFrozen(RECRUITMENT_REPOSITORY_METHODS)).toBe(true);
      expect(Object.isFrozen(RECRUITMENT_EVENT_REPOSITORY_METHODS)).toBe(true);
      expect(Object.isFrozen(REVIEW_REPOSITORY_METHODS)).toBe(true);

      expect(RECRUITMENT_REPOSITORY_METHODS).toEqual([
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

      expect(RECRUITMENT_EVENT_REPOSITORY_METHODS).toEqual([
        "tableExists",
        "createRecruitmentEvent",
        "getRecruitmentEventById",
        "listRecruitmentEventsByRecruitmentId",
        "updateRecruitmentEvent"
      ]);

      expect(REVIEW_REPOSITORY_METHODS).toEqual([
        "tableExists",
        "createReviewItem",
        "getReviewItemById",
        "findPendingReviewItems",
        "listReviewItems",
        "updateReviewDecision"
      ]);
    });

    test("REPOSITORY_CONTRACTS is frozen and maps all domains", () => {
      expect(Object.isFrozen(REPOSITORY_CONTRACTS)).toBe(true);
      expect(Object.keys(REPOSITORY_CONTRACTS).sort()).toEqual(
        listRepositoryDomains()
      );
      for (const domain of listRepositoryDomains()) {
        expect(Object.isFrozen(REPOSITORY_CONTRACTS[domain])).toBe(true);
        expect(REPOSITORY_CONTRACTS[domain].domain).toBe(domain);
        expect(Array.isArray(REPOSITORY_CONTRACTS[domain].methods)).toBe(true);
        expect(typeof REPOSITORY_CONTRACTS[domain].description).toBe("string");
      }
    });

    test("CONTRACT_NOT_IMPLEMENTED constant is stable", () => {
      expect(CONTRACT_NOT_IMPLEMENTED).toBe("CONTRACT_NOT_IMPLEMENTED");
    });
  });

  describe("required methods exist (contract catalog)", () => {
    test("recruitment contract lists persistence-appropriate methods", () => {
      const methods = getRequiredMethods(REPOSITORY_DOMAINS.RECRUITMENT);
      expect(methods).toContain("createRecruitment");
      expect(methods).toContain("getRecruitmentById");
      expect(methods).toContain("updateRecruitment");
      expect(methods).toContain("findCandidatesForLookup");
      expect(methods.length).toBe(RECRUITMENT_REPOSITORY_METHODS.length);
    });

    test("recruitment event contract lists persistence-appropriate methods", () => {
      const methods = getRequiredMethods(
        REPOSITORY_DOMAINS.RECRUITMENT_EVENT
      );
      expect(methods).toContain("createRecruitmentEvent");
      expect(methods).toContain("getRecruitmentEventById");
      expect(methods).toContain("listRecruitmentEventsByRecruitmentId");
      expect(methods).toContain("updateRecruitmentEvent");
      expect(methods.length).toBe(
        RECRUITMENT_EVENT_REPOSITORY_METHODS.length
      );
    });

    test("review contract lists persistence-appropriate methods", () => {
      const methods = getRequiredMethods(REPOSITORY_DOMAINS.REVIEW);
      expect(methods).toContain("createReviewItem");
      expect(methods).toContain("getReviewItemById");
      expect(methods).toContain("findPendingReviewItems");
      expect(methods).toContain("updateReviewDecision");
      expect(methods.length).toBe(REVIEW_REPOSITORY_METHODS.length);
    });

    test("getRepositoryContract returns frozen descriptor copies", () => {
      const a = getRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT);
      const b = getRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.methods).not.toBe(b.methods);
      expect(Object.isFrozen(a)).toBe(true);
      a.methods.push("injected");
      expect(getRequiredMethods(REPOSITORY_DOMAINS.RECRUITMENT)).not.toContain(
        "injected"
      );
    });

    test("unknown domain returns null / empty methods", () => {
      expect(getRepositoryContract("unknown")).toBeNull();
      expect(getRequiredMethods("unknown")).toEqual([]);
      expect(getRepositoryContract(null)).toBeNull();
    });
  });

  describe("contract consistency", () => {
    test("listRepositoryDomains is deterministic and sorted", () => {
      expect(listRepositoryDomains()).toEqual([
        "recruitment",
        "recruitment_event",
        "review"
      ]);
      expect(listRepositoryDomains()).toEqual(listRepositoryDomains());
    });

    test("domain lookup is case-insensitive and trimmed", () => {
      expect(
        getRepositoryContract("  Recruitment  ").domain
      ).toBe(REPOSITORY_DOMAINS.RECRUITMENT);
      expect(
        getRequiredMethods("REVIEW").length
      ).toBe(REVIEW_REPOSITORY_METHODS.length);
    });

    test("every domain contract has unique non-empty method names", () => {
      for (const domain of listRepositoryDomains()) {
        const methods = getRequiredMethods(domain);
        expect(methods.length).toBeGreaterThan(0);
        expect(new Set(methods).size).toBe(methods.length);
        for (const name of methods) {
          expect(typeof name).toBe("string");
          expect(name.trim().length).toBeGreaterThan(0);
        }
      }
    });

    test("validateRepositoryContract accepts a complete function stub", () => {
      const stub = buildStubFromMethods(RECRUITMENT_REPOSITORY_METHODS);
      const result = validateRepositoryContract(
        REPOSITORY_DOMAINS.RECRUITMENT,
        stub
      );
      expect(result).toEqual({
        valid: true,
        domain: REPOSITORY_DOMAINS.RECRUITMENT,
        missingMethods: [],
        nonFunctionMethods: [],
        architectureOnly: true,
        sideEffects: false
      });
      expect(implementsRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT, stub)).toBe(
        true
      );
      expect(
        assertRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT, stub)
      ).toEqual(result);
    });

    test("validateRepositoryContract reports missing and non-function methods", () => {
      const partial = {
        tableExists: () => true,
        createRecruitment: "not-a-function"
      };
      const result = validateRepositoryContract(
        REPOSITORY_DOMAINS.RECRUITMENT,
        partial
      );
      expect(result.valid).toBe(false);
      expect(result.nonFunctionMethods).toEqual(["createRecruitment"]);
      expect(result.missingMethods).toContain("getRecruitmentById");
      expect(result.architectureOnly).toBe(true);
      expect(result.sideEffects).toBe(false);
      expect(
        implementsRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT, partial)
      ).toBe(false);
    });

    test("validateRepositoryContract rejects null and unknown domain", () => {
      expect(
        validateRepositoryContract(REPOSITORY_DOMAINS.REVIEW, null)
      ).toEqual(
        expect.objectContaining({
          valid: false,
          domain: REPOSITORY_DOMAINS.REVIEW,
          missingMethods: REVIEW_REPOSITORY_METHODS.slice(),
          architectureOnly: true,
          sideEffects: false
        })
      );
      expect(validateRepositoryContract("nope", {})).toEqual({
        valid: false,
        domain: null,
        missingMethods: [],
        nonFunctionMethods: [],
        architectureOnly: true,
        sideEffects: false
      });
    });

    test("assertRepositoryContract throws CONTRACT_NOT_IMPLEMENTED on failure", () => {
      expect(() =>
        assertRepositoryContract(REPOSITORY_DOMAINS.REVIEW, {})
      ).toThrow(/Repository contract assertion failed/);
      try {
        assertRepositoryContract(REPOSITORY_DOMAINS.REVIEW, {});
      } catch (err) {
        expect(err.code).toBe(CONTRACT_NOT_IMPLEMENTED);
        expect(err.validation.valid).toBe(false);
      }
    });

    test("all three domains validate against createAllUnimplementedRepositories", () => {
      const repos = createAllUnimplementedRepositories();
      expect(
        implementsRepositoryContract(
          REPOSITORY_DOMAINS.RECRUITMENT,
          repos.recruitment
        )
      ).toBe(true);
      expect(
        implementsRepositoryContract(
          REPOSITORY_DOMAINS.RECRUITMENT_EVENT,
          repos.recruitmentEvent
        )
      ).toBe(true);
      expect(
        implementsRepositoryContract(REPOSITORY_DOMAINS.REVIEW, repos.review)
      ).toBe(true);
    });
  });

  describe("unimplemented stubs (DI-ready, no persistence)", () => {
    test("createUnimplementedRepository throws on unknown domain", () => {
      expect(() => createUnimplementedRepository("ghost")).toThrow(
        /Unknown repository domain/
      );
    });

    test("stub methods throw CONTRACT_NOT_IMPLEMENTED without side effects", () => {
      const repo = createUnimplementedRepository(
        REPOSITORY_DOMAINS.RECRUITMENT_EVENT
      );
      expect(Object.isFrozen(repo)).toBe(true);
      expect(() => repo.createRecruitmentEvent({ recruitment_id: 1 })).toThrow(
        /not implemented/
      );
      try {
        repo.tableExists();
      } catch (err) {
        expect(err.code).toBe(CONTRACT_NOT_IMPLEMENTED);
        expect(err.domain).toBe(REPOSITORY_DOMAINS.RECRUITMENT_EVENT);
        expect(err.method).toBe("tableExists");
        expect(err.architectureOnly).toBe(true);
      }
    });

    test("createAllUnimplementedRepositories returns frozen bag of stubs", () => {
      const bag = createAllUnimplementedRepositories();
      expect(Object.isFrozen(bag)).toBe(true);
      expect(Object.keys(bag).sort()).toEqual([
        "recruitment",
        "recruitmentEvent",
        "review"
      ]);
    });
  });

  describe("deterministic / pure behavior", () => {
    test("identical validation inputs yield identical outputs", () => {
      const candidate = buildStubFromMethods(REVIEW_REPOSITORY_METHODS);
      const a = validateRepositoryContract(REPOSITORY_DOMAINS.REVIEW, candidate);
      const b = validateRepositoryContract(REPOSITORY_DOMAINS.REVIEW, candidate);
      expect(a).toEqual(b);
    });

    test("does not mutate candidate or method lists", () => {
      const candidate = buildStubFromMethods(
        RECRUITMENT_EVENT_REPOSITORY_METHODS
      );
      const before = JSON.stringify(Object.keys(candidate).sort());
      validateRepositoryContract(
        REPOSITORY_DOMAINS.RECRUITMENT_EVENT,
        candidate
      );
      getRequiredMethods(REPOSITORY_DOMAINS.RECRUITMENT_EVENT).push("x");
      expect(JSON.stringify(Object.keys(candidate).sort())).toBe(before);
      expect(RECRUITMENT_EVENT_REPOSITORY_METHODS).not.toContain("x");
    });

    test("validation never invokes candidate methods", () => {
      let calls = 0;
      const spy = () => {
        calls += 1;
        throw new Error("should not be called");
      };
      const candidate = buildStubFromMethods(
        RECRUITMENT_REPOSITORY_METHODS,
        spy
      );
      expect(
        implementsRepositoryContract(REPOSITORY_DOMAINS.RECRUITMENT, candidate)
      ).toBe(true);
      expect(calls).toBe(0);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("contracts module has no DB / Express / queue / filesystem / SQL", () => {
      const source = read(
        "server/lib/recruitment/persistenceRepositoryContracts.js"
      );
      expect(source).toMatch(/Phase 35/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never accesses databases/);
      expect(source).not.toMatch(/mysql2|createPool/i);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
      expect(source).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/i);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/\bSELECT\s+.+\s+FROM\b/i);
      expect(source).not.toMatch(/information_schema/i);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/repositories\//);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/require\(["'].*db["']\)/);
      expect(source).not.toMatch(/require\(["']\./);
    });

    test("contracts module has zero require dependencies (pure surface)", () => {
      const source = read(
        "server/lib/recruitment/persistenceRepositoryContracts.js"
      );
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
    });

    test("siteWorker is unchanged — contracts not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/persistenceRepositoryContracts/);
      expect(worker).not.toMatch(/createUnimplementedRepository/);
      expect(worker).not.toMatch(/REPOSITORY_DOMAINS/);
      expect(worker).not.toMatch(/runtimePersistenceService/);
      expect(worker).not.toMatch(/executeRuntimePersistence/);
      expect(worker).toMatch(/Never persists review items/);
    });

    test("runtime persistence service / policy remain unwired to contracts", () => {
      const service = read(
        "server/lib/recruitment/runtimePersistenceService.js"
      );
      const policy = read(
        "server/lib/recruitment/runtimePersistencePolicy.js"
      );
      expect(service).not.toMatch(/persistenceRepositoryContracts/);
      expect(policy).not.toMatch(/persistenceRepositoryContracts/);
      expect(service).toMatch(/EXECUTION_NOT_IMPLEMENTED/);
    });

    test("preview buffer and review service do not import contracts", () => {
      const preview = read("server/lib/recruitment/runtimePreviewBuffer.js");
      const reviewService = read(
        "server/services/recruitmentReview.service.js"
      );
      expect(preview).not.toMatch(/persistenceRepositoryContracts/);
      expect(reviewService).not.toMatch(/persistenceRepositoryContracts/);
    });

    test("concrete MySQL repositories are not modified by this phase surface", () => {
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
      expect(recruitment).not.toMatch(/Phase 35/);
      expect(event).not.toMatch(/Phase 35/);
      expect(review).not.toMatch(/Phase 35/);
    });
  });
});
