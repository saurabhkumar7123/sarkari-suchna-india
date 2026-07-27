"use strict";

/**
 * Phase 67 — Recruitment Integration Mapping tests.
 * Pure descriptive foundation: exports, immutability, helper behavior,
 * mapping uniqueness, adoption order, descriptive integrity, architecture
 * boundaries, zero runtime dependencies, and no circular references.
 */

const fs = require("fs");
const path = require("path");

const {
  INTEGRATION_MAP_PHASE,
  FOUNDATION_PHASES,
  PRODUCTION_AREAS,
  SUPPORTED_PRODUCTION_AREAS,
  INTEGRATION_TARGETS,
  INTEGRATION_TARGET_IDS,
  SUPPORTED_INTEGRATION_TARGET_IDS,
  INTEGRATION_TARGET_BY_ID,
  ADOPTION_ORDER,
  ADOPTION_ORDER_TARGET_IDS,
  RECRUITMENT_INTEGRATION,
  INTEGRATION_MAP_METADATA,
  getIntegrationTargets,
  getIntegrationTarget,
  listAdoptionOrder,
  summarizeRecruitmentIntegrationMap
} = require("../server/lib/recruitment/recruitmentIntegrationMap");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentIntegrationMap.js";

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function hasCircularReference(value, seen = new WeakSet(), stack = new WeakSet()) {
  if (value == null || typeof value !== "object") {
    return false;
  }
  if (stack.has(value)) {
    return true;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  stack.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      if (hasCircularReference(value[i], seen, stack)) {
        return true;
      }
    }
    stack.delete(value);
    return false;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    if (hasCircularReference(value[keys[i]], seen, stack)) {
      return true;
    }
  }
  stack.delete(value);
  return false;
}

function collectFrozenNodes(value, nodes = []) {
  if (value == null || typeof value !== "object") {
    return nodes;
  }
  nodes.push(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectFrozenNodes(value[i], nodes);
    }
    return nodes;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    collectFrozenNodes(value[keys[i]], nodes);
  }
  return nodes;
}

function assertAllFrozen(value) {
  const nodes = collectFrozenNodes(value);
  for (let i = 0; i < nodes.length; i += 1) {
    expect(Object.isFrozen(nodes[i])).toBe(true);
  }
}

describe("Phase 67 — recruitmentIntegrationMap", () => {
  describe("exports", () => {
    test("exposes phase 67 integration map constants and descriptors", () => {
      expect(INTEGRATION_MAP_PHASE).toBe(67);
      expect(RECRUITMENT_INTEGRATION.entity).toBe("recruitment_integration_map");
      expect(RECRUITMENT_INTEGRATION.phase).toBe(67);
      expect(INTEGRATION_MAP_METADATA.descriptiveOnly).toBe(true);
      expect(INTEGRATION_MAP_METADATA.runtimeIntegration).toBe(false);
      expect(INTEGRATION_MAP_METADATA.buildsOnMatchingContractsPhase).toBe(66);
    });

    test("exports all seven production area keys", () => {
      expect(PRODUCTION_AREAS.WORKER).toBe("worker");
      expect(PRODUCTION_AREAS.GENERATOR).toBe("generator");
      expect(PRODUCTION_AREAS.PREVIEW).toBe("preview");
      expect(PRODUCTION_AREAS.PAGES).toBe("pages");
      expect(PRODUCTION_AREAS.UPDATES).toBe("updates");
      expect(PRODUCTION_AREAS.PERSISTENCE).toBe("persistence");
      expect(PRODUCTION_AREAS.DIAGNOSTICS).toBe("diagnostics");
      expect(SUPPORTED_PRODUCTION_AREAS.size).toBe(7);
    });

    test("exports foundation phase references for phases 63–67", () => {
      expect(FOUNDATION_PHASES.DOMAIN_MODEL).toBe(63);
      expect(FOUNDATION_PHASES.LIFECYCLE_CONTRACTS).toBe(64);
      expect(FOUNDATION_PHASES.IDENTITY_MODEL).toBe(65);
      expect(FOUNDATION_PHASES.MATCHING_CONTRACTS).toBe(66);
      expect(FOUNDATION_PHASES.INTEGRATION_MAP).toBe(67);
    });

    test("exports helper functions", () => {
      expect(typeof getIntegrationTargets).toBe("function");
      expect(typeof getIntegrationTarget).toBe("function");
      expect(typeof listAdoptionOrder).toBe("function");
      expect(typeof summarizeRecruitmentIntegrationMap).toBe("function");
    });
  });

  describe("integration target catalog", () => {
    test("defines exactly seven integration targets", () => {
      expect(INTEGRATION_TARGETS.length).toBe(7);
      expect(INTEGRATION_TARGET_IDS.length).toBe(7);
      expect(SUPPORTED_INTEGRATION_TARGET_IDS.size).toBe(7);
    });

    test("integration target ids are unique", () => {
      const unique = new Set(INTEGRATION_TARGET_IDS);
      expect(unique.size).toBe(INTEGRATION_TARGET_IDS.length);
    });

    test("INTEGRATION_TARGET_BY_ID indexes every target", () => {
      for (const target of INTEGRATION_TARGETS) {
        expect(INTEGRATION_TARGET_BY_ID[target.id]).toBe(target);
      }
    });

    test("each target has required descriptive fields", () => {
      for (const target of INTEGRATION_TARGETS) {
        expect(typeof target.id).toBe("string");
        expect(typeof target.label).toBe("string");
        expect(typeof target.order).toBe("number");
        expect(typeof target.productionArea).toBe("string");
        expect(Array.isArray(target.productionPaths)).toBe(true);
        expect(target.productionPaths.length).toBeGreaterThan(0);
        expect(Array.isArray(target.consumes)).toBe(true);
        expect(target.consumes.length).toBeGreaterThan(0);
        expect(Array.isArray(target.produces)).toBe(true);
        expect(target.produces.length).toBeGreaterThan(0);
        expect(typeof target.optional).toBe("boolean");
        expect(typeof target.futureImplementationPhase).toBe("number");
        expect(Array.isArray(target.foundationPhases)).toBe(true);
        expect(target.foundationPhases.length).toBeGreaterThan(0);
        expect(Array.isArray(target.advisoryNotes)).toBe(true);
        expect(target.advisoryNotes.length).toBeGreaterThan(0);
      }
    });

    test("target order values are unique and positive", () => {
      const orders = INTEGRATION_TARGETS.map((target) => target.order);
      expect(new Set(orders).size).toBe(orders.length);
      for (const order of orders) {
        expect(order).toBeGreaterThan(0);
      }
    });

    test("future implementation phases are strictly after phase 67", () => {
      for (const target of INTEGRATION_TARGETS) {
        expect(target.futureImplementationPhase).toBeGreaterThan(67);
      }
    });

    test("required targets are updates, worker, and persistence", () => {
      expect(RECRUITMENT_INTEGRATION.requiredTargets).toEqual([
        "updates",
        "worker",
        "persistence"
      ]);
    });

    test("optional targets are diagnostics, preview, pages, and generator", () => {
      expect(RECRUITMENT_INTEGRATION.optionalTargets).toEqual([
        "diagnostics",
        "preview",
        "pages",
        "generator"
      ]);
    });
  });

  describe("adoption order", () => {
    test("defines seven adoption steps", () => {
      expect(ADOPTION_ORDER.length).toBe(7);
      expect(ADOPTION_ORDER_TARGET_IDS.length).toBe(7);
    });

    test("adoption order sequence is 1 through 7", () => {
      const orders = ADOPTION_ORDER.map((entry) => entry.order);
      expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    test("adoption order target ids are unique and match integration targets", () => {
      const unique = new Set(ADOPTION_ORDER_TARGET_IDS);
      expect(unique.size).toBe(ADOPTION_ORDER_TARGET_IDS.length);
      for (const targetId of ADOPTION_ORDER_TARGET_IDS) {
        expect(SUPPORTED_INTEGRATION_TARGET_IDS.has(targetId)).toBe(true);
      }
    });

    test("adoption order covers every integration target exactly once", () => {
      const sortedByOrder = [...ADOPTION_ORDER]
        .sort((a, b) => a.order - b.order)
        .map((entry) => entry.targetId);
      expect(sortedByOrder).toEqual([...INTEGRATION_TARGET_IDS].sort((a, b) => {
        const orderA = INTEGRATION_TARGET_BY_ID[a].order;
        const orderB = INTEGRATION_TARGET_BY_ID[b].order;
        return orderA - orderB;
      }));
    });

    test("adoption order starts with updates and ends with generator", () => {
      expect(RECRUITMENT_INTEGRATION.firstAdoptionTarget).toBe("updates");
      expect(RECRUITMENT_INTEGRATION.lastAdoptionTarget).toBe("generator");
      expect(ADOPTION_ORDER[0].targetId).toBe("updates");
      expect(ADOPTION_ORDER[6].targetId).toBe("generator");
    });

    test("each adoption step has rationale and future phase", () => {
      for (const entry of ADOPTION_ORDER) {
        expect(typeof entry.label).toBe("string");
        expect(typeof entry.rationale).toBe("string");
        expect(entry.rationale.length).toBeGreaterThan(20);
        expect(entry.futureImplementationPhase).toBeGreaterThan(67);
        expect(getIntegrationTarget(entry.targetId).futureImplementationPhase).toBe(
          entry.futureImplementationPhase
        );
      }
    });

    test("future implementation phases increase monotonically in adoption order", () => {
      const phases = ADOPTION_ORDER.map((entry) => entry.futureImplementationPhase);
      for (let i = 1; i < phases.length; i += 1) {
        expect(phases[i]).toBeGreaterThan(phases[i - 1]);
      }
    });
  });

  describe("helper behavior", () => {
    test("getIntegrationTargets returns the frozen catalog", () => {
      expect(getIntegrationTargets()).toBe(INTEGRATION_TARGETS);
      expect(getIntegrationTargets().length).toBe(7);
    });

    test("getIntegrationTarget resolves known targets", () => {
      expect(getIntegrationTarget("worker")).toBe(INTEGRATION_TARGET_BY_ID.worker);
      expect(getIntegrationTarget("preview")).toBe(INTEGRATION_TARGET_BY_ID.preview);
      expect(getIntegrationTarget("persistence")).toBe(
        INTEGRATION_TARGET_BY_ID.persistence
      );
    });

    test("getIntegrationTarget normalizes whitespace and is case-sensitive", () => {
      expect(getIntegrationTarget("  worker  ")).toBe(INTEGRATION_TARGET_BY_ID.worker);
      expect(getIntegrationTarget("Worker")).toBeNull();
    });

    test("getIntegrationTarget returns null for unknown or empty ids", () => {
      expect(getIntegrationTarget("unknown")).toBeNull();
      expect(getIntegrationTarget("")).toBeNull();
      expect(getIntegrationTarget(null)).toBeNull();
      expect(getIntegrationTarget(undefined)).toBeNull();
    });

    test("listAdoptionOrder returns the frozen adoption sequence", () => {
      expect(listAdoptionOrder()).toBe(ADOPTION_ORDER);
      expect(listAdoptionOrder().length).toBe(7);
    });

    test("summarizeRecruitmentIntegrationMap returns frozen summary", () => {
      const summary = summarizeRecruitmentIntegrationMap();
      expect(Object.isFrozen(summary)).toBe(true);
      expect(summary.phase).toBe(67);
      expect(summary.entity).toBe("recruitment_integration_map");
      expect(summary.integrationTargetCount).toBe(7);
      expect(summary.adoptionStepCount).toBe(7);
      expect(summary.descriptiveOnly).toBe(true);
      expect(summary.runtimeIntegration).toBe(false);
      expect(summary.buildsOnDomainModelPhase).toBe(63);
      expect(summary.buildsOnLifecycleContractsPhase).toBe(64);
      expect(summary.buildsOnIdentityModelPhase).toBe(65);
      expect(summary.buildsOnMatchingContractsPhase).toBe(66);
    });

    test("helpers only read metadata without side effects", () => {
      const before = summarizeRecruitmentIntegrationMap();
      getIntegrationTarget("updates");
      getIntegrationTarget("generator");
      listAdoptionOrder();
      getIntegrationTargets();
      const after = summarizeRecruitmentIntegrationMap();
      expect(after).toEqual(before);
      expect(INTEGRATION_MAP_METADATA.sideEffects).toBe(false);
    });
  });

  describe("descriptive integrity", () => {
    test("consumes reference foundation vocabulary without module imports", () => {
      for (const target of INTEGRATION_TARGETS) {
        for (const item of target.consumes) {
          expect(item).toMatch(
            /^(recruitment(DomainModel|LifecycleContracts|IdentityModel|MatchingContracts)|integration_map)\./
          );
        }
      }
    });

    test("produces use dotted namespaced descriptors", () => {
      for (const target of INTEGRATION_TARGETS) {
        for (const item of target.produces) {
          expect(item).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
        }
      }
    });

    test("production paths point at server modules", () => {
      for (const target of INTEGRATION_TARGETS) {
        for (const relPath of target.productionPaths) {
          expect(relPath).toMatch(/^server\//);
        }
      }
    });

    test("worker target consumes all four foundation layers", () => {
      const worker = getIntegrationTarget("worker");
      expect(worker.foundationPhases).toEqual([63, 64, 65, 66]);
    });

    test("updates target is the only target without matching contracts phase", () => {
      const updates = getIntegrationTarget("updates");
      expect(updates.foundationPhases).toEqual([63, 64, 65]);
      expect(updates.foundationPhases).not.toContain(66);
    });

    test("integration map metadata counts align with catalog", () => {
      expect(INTEGRATION_MAP_METADATA.integrationTargetCount).toBe(
        INTEGRATION_TARGETS.length
      );
      expect(INTEGRATION_MAP_METADATA.adoptionStepCount).toBe(ADOPTION_ORDER.length);
      expect(INTEGRATION_MAP_METADATA.requiredTargetCount).toBe(3);
      expect(INTEGRATION_MAP_METADATA.optionalTargetCount).toBe(4);
    });
  });

  describe("immutability", () => {
    test("top-level exported constants are frozen", () => {
      expect(Object.isFrozen(INTEGRATION_TARGETS)).toBe(true);
      expect(Object.isFrozen(INTEGRATION_TARGET_BY_ID)).toBe(true);
      expect(Object.isFrozen(ADOPTION_ORDER)).toBe(true);
      expect(Object.isFrozen(RECRUITMENT_INTEGRATION)).toBe(true);
      expect(Object.isFrozen(INTEGRATION_MAP_METADATA)).toBe(true);
      expect(Object.isFrozen(FOUNDATION_PHASES)).toBe(true);
      expect(Object.isFrozen(PRODUCTION_AREAS)).toBe(true);
    });

    test("nested integration graph is deeply frozen", () => {
      assertAllFrozen(INTEGRATION_TARGETS);
      assertAllFrozen(ADOPTION_ORDER);
      assertAllFrozen(RECRUITMENT_INTEGRATION);
      assertAllFrozen(INTEGRATION_MAP_METADATA);
    });

    test("mutation attempts on target catalog do not change exports", () => {
      const before = INTEGRATION_TARGETS.length;
      expect(() => {
        INTEGRATION_TARGETS.push({});
      }).toThrow();
      expect(INTEGRATION_TARGETS.length).toBe(before);
    });

    test("mutation attempts on adoption order are rejected", () => {
      expect(() => {
        ADOPTION_ORDER[0].order = 99;
      }).toThrow();
      expect(ADOPTION_ORDER[0].order).toBe(1);
    });

    test("mutation attempts on target advisory notes are rejected", () => {
      const worker = getIntegrationTarget("worker");
      expect(() => {
        worker.advisoryNotes.push("bogus");
      }).toThrow();
      expect(worker.advisoryNotes).not.toContain("bogus");
    });
  });

  describe("circular references", () => {
    test("exported integration graph has no circular references", () => {
      expect(hasCircularReference(INTEGRATION_TARGETS)).toBe(false);
      expect(hasCircularReference(INTEGRATION_TARGET_BY_ID)).toBe(false);
      expect(hasCircularReference(ADOPTION_ORDER)).toBe(false);
      expect(hasCircularReference(RECRUITMENT_INTEGRATION)).toBe(false);
      expect(hasCircularReference(INTEGRATION_MAP_METADATA)).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("integration map module has no DB / Express / filesystem / env access", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/Phase 67/);
      expect(source).toMatch(/Pure descriptive library/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
    });

    test("integration map module has zero require dependencies", () => {
      const source = read(MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
    });

    test("module references foundation vocabulary as strings only — no require imports", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/No imports from other recruitment modules/i);
      expect(source).toMatch(/recruitmentDomainModel\./);
      expect(source).toMatch(/recruitmentMatchingContracts\./);
      expect(source).not.toMatch(
        /require\(["'].*recruitment(DomainModel|LifecycleContracts|IdentityModel|MatchingContracts)/
      );
      expect(source).not.toMatch(/require\(["'].*runRecruitmentPipeline/);
      expect(source).not.toMatch(/require\(["'].*siteWorker/);
    });

    test("production modules are unchanged — integration map not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/recruitmentIntegrationMap/);

      const domainModel = read("server/lib/recruitment/recruitmentDomainModel.js");
      expect(domainModel).not.toMatch(/recruitmentIntegrationMap/);

      const lifecycleContracts = read(
        "server/lib/recruitment/recruitmentLifecycleContracts.js"
      );
      expect(lifecycleContracts).not.toMatch(/recruitmentIntegrationMap/);

      const identityModel = read("server/lib/recruitment/recruitmentIdentityModel.js");
      expect(identityModel).not.toMatch(/recruitmentIntegrationMap/);

      const matchingContracts = read(
        "server/lib/recruitment/recruitmentMatchingContracts.js"
      );
      expect(matchingContracts).not.toMatch(/recruitmentIntegrationMap/);

      const preview = read("server/lib/recruitment/runtimePreviewBuffer.js");
      const policy = read("server/lib/recruitment/runtimePersistencePolicy.js");
      expect(preview).not.toMatch(/recruitmentIntegrationMap/);
      expect(policy).not.toMatch(/recruitmentIntegrationMap/);
    });

    test("runtime, capability, and diagnostics modules do not import integration map", () => {
      const modules = [
        "server/lib/recruitment/runtimeCapabilityRegistry.js",
        "server/lib/recruitment/runtimeCapabilityPreviewIntegration.js",
        "server/lib/recruitment/previewIntegrationContract.js",
        "server/lib/recruitment/executionDiagnostics.js",
        "server/lib/recruitment/executionDiagnosticsCapabilityIntegration.js",
        "server/lib/recruitment/persistenceEnablement.js",
        "server/lib/recruitment/controlledRuntimeExecutionAdapter.js",
        "server/lib/recruitment/runRecruitmentPipeline.js"
      ];
      for (const relPath of modules) {
        expect(read(relPath)).not.toMatch(/recruitmentIntegrationMap/);
      }
    });

    test("generator and pages services do not import integration map", () => {
      const modules = [
        "server/services/generatorDraft.service.js",
        "server/services/page.service.js",
        "server/services/recruitmentPageLink.service.js",
        "server/services/updates/updates.repository.js"
      ];
      for (const relPath of modules) {
        expect(read(relPath)).not.toMatch(/recruitmentIntegrationMap/);
      }
    });
  });
});
