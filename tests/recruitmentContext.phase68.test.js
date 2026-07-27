"use strict";

/**
 * Phase 68 — Recruitment Context tests.
 * Pure descriptive foundation: exports, immutability, context creation,
 * validation, helper behavior, architecture boundaries, and no runtime integration.
 */

const fs = require("fs");
const path = require("path");

const {
  RECRUITMENT_CONTEXT_PHASE,
  FOUNDATION_PHASES,
  CONTEXT_SECTION_KEYS,
  SUPPORTED_CONTEXT_SECTION_KEYS,
  DOMAIN_CONTEXT_SECTION,
  LIFECYCLE_CONTEXT_SECTION,
  IDENTITY_CONTEXT_SECTION,
  MATCHING_CONTEXT_SECTION,
  INTEGRATION_CONTEXT_SECTION,
  RECRUITMENT_CONTEXT_DESCRIPTOR,
  RECRUITMENT_CONTEXT_METADATA,
  DEFAULT_RECRUITMENT_CONTEXT,
  createRecruitmentContext,
  isRecruitmentContext,
  summarizeRecruitmentContext
} = require("../server/lib/recruitment/recruitmentContext");

const domainModel = require("../server/lib/recruitment/recruitmentDomainModel");
const lifecycleContracts = require("../server/lib/recruitment/recruitmentLifecycleContracts");
const identityModel = require("../server/lib/recruitment/recruitmentIdentityModel");
const matchingContracts = require("../server/lib/recruitment/recruitmentMatchingContracts");
const integrationMap = require("../server/lib/recruitment/recruitmentIntegrationMap");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentContext.js";

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

describe("Phase 68 — recruitmentContext", () => {
  describe("exports", () => {
    test("exposes phase 68 context constants and descriptor", () => {
      expect(RECRUITMENT_CONTEXT_PHASE).toBe(68);
      expect(RECRUITMENT_CONTEXT_DESCRIPTOR.entity).toBe("recruitment_context");
      expect(RECRUITMENT_CONTEXT_DESCRIPTOR.domain).toBe("recruitment");
      expect(RECRUITMENT_CONTEXT_DESCRIPTOR.phase).toBe(68);
      expect(RECRUITMENT_CONTEXT_METADATA.descriptiveOnly).toBe(true);
      expect(RECRUITMENT_CONTEXT_METADATA.runtimeIntegration).toBe(false);
      expect(RECRUITMENT_CONTEXT_METADATA.workerIntegration).toBe(false);
      expect(RECRUITMENT_CONTEXT_METADATA.generatorIntegration).toBe(false);
    });

    test("exports foundation phase references for phases 63–68", () => {
      expect(FOUNDATION_PHASES.DOMAIN_MODEL).toBe(63);
      expect(FOUNDATION_PHASES.LIFECYCLE_CONTRACTS).toBe(64);
      expect(FOUNDATION_PHASES.IDENTITY_MODEL).toBe(65);
      expect(FOUNDATION_PHASES.MATCHING_CONTRACTS).toBe(66);
      expect(FOUNDATION_PHASES.INTEGRATION_MAP).toBe(67);
      expect(FOUNDATION_PHASES.RECRUITMENT_CONTEXT).toBe(68);
    });

    test("exports five context section keys", () => {
      expect(CONTEXT_SECTION_KEYS).toEqual([
        "domain",
        "lifecycle",
        "identity",
        "matching",
        "integration"
      ]);
      expect(SUPPORTED_CONTEXT_SECTION_KEYS.size).toBe(5);
    });

    test("exports standalone context section snapshots", () => {
      expect(DOMAIN_CONTEXT_SECTION.section).toBe("domain");
      expect(LIFECYCLE_CONTEXT_SECTION.section).toBe("lifecycle");
      expect(IDENTITY_CONTEXT_SECTION.section).toBe("identity");
      expect(MATCHING_CONTEXT_SECTION.section).toBe("matching");
      expect(INTEGRATION_CONTEXT_SECTION.section).toBe("integration");
    });

    test("exports helper functions", () => {
      expect(typeof createRecruitmentContext).toBe("function");
      expect(typeof isRecruitmentContext).toBe("function");
      expect(typeof summarizeRecruitmentContext).toBe("function");
    });

    test("default context is a valid recruitment context", () => {
      expect(isRecruitmentContext(DEFAULT_RECRUITMENT_CONTEXT)).toBe(true);
      expect(DEFAULT_RECRUITMENT_CONTEXT.phase).toBe(68);
      expect(DEFAULT_RECRUITMENT_CONTEXT.metadata.createReason).toBe("default");
    });
  });

  describe("context model", () => {
    test("organizes domain, lifecycle, identity, matching, and integration sections", () => {
      for (const key of CONTEXT_SECTION_KEYS) {
        expect(DEFAULT_RECRUITMENT_CONTEXT[key]).toBeDefined();
        expect(DEFAULT_RECRUITMENT_CONTEXT[key].section).toBe(key);
      }
    });

    test("domain section aligns with phase 63 vocabulary", () => {
      expect(DEFAULT_RECRUITMENT_CONTEXT.domain.phase).toBe(63);
      expect(DEFAULT_RECRUITMENT_CONTEXT.domain.module).toBe("recruitmentDomainModel");
      expect(DEFAULT_RECRUITMENT_CONTEXT.domain.lifecycleEventTypes).toEqual(
        domainModel.LIFECYCLE_EVENT_TYPES
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.domain.recruitmentLifecycleStates).toEqual(
        domainModel.RECRUITMENT_LIFECYCLE_STATES
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.domain.lifecycleEventCount).toBe(
        domainModel.LIFECYCLE_EVENTS.length
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.domain.primaryEventType).toBe(
        domainModel.PRIMARY_EVENT_CONCEPT.primaryEventType
      );
    });

    test("lifecycle section aligns with phase 64 contracts", () => {
      expect(DEFAULT_RECRUITMENT_CONTEXT.lifecycle.phase).toBe(64);
      expect(DEFAULT_RECRUITMENT_CONTEXT.lifecycle.contractCount).toBe(
        lifecycleContracts.LIFECYCLE_EVENT_CONTRACTS.length
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.lifecycle.primaryContractIds).toEqual(
        lifecycleContracts.PRIMARY_LIFECYCLE_CONTRACT_IDS
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.lifecycle.terminalContractIds).toEqual(
        lifecycleContracts.TERMINAL_LIFECYCLE_CONTRACT_IDS
      );
    });

    test("identity section aligns with phase 65 identity model", () => {
      expect(DEFAULT_RECRUITMENT_CONTEXT.identity.phase).toBe(65);
      expect(DEFAULT_RECRUITMENT_CONTEXT.identity.signalKeys).toEqual(
        identityModel.IDENTITY_SIGNAL_KEYS
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.identity.signalCount).toBe(
        identityModel.IDENTITY_SIGNALS.length
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.identity.primaryAnchorIds).toEqual(
        identityModel.PRIMARY_IDENTITY_ANCHOR_IDS
      );
    });

    test("matching section aligns with phase 66 matching contracts", () => {
      expect(DEFAULT_RECRUITMENT_CONTEXT.matching.phase).toBe(66);
      expect(DEFAULT_RECRUITMENT_CONTEXT.matching.matchSignalKeys).toEqual(
        matchingContracts.MATCH_SIGNAL_KEYS
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.matching.primarySignalKeys).toEqual(
        matchingContracts.RECRUITMENT_MATCHING.primarySignalKeys
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.matching.matchingProfileCount).toBe(
        matchingContracts.MATCHING_PROFILES.length
      );
    });

    test("integration section aligns with phase 67 integration map", () => {
      expect(DEFAULT_RECRUITMENT_CONTEXT.integration.phase).toBe(67);
      expect(DEFAULT_RECRUITMENT_CONTEXT.integration.integrationTargetIds).toEqual(
        integrationMap.INTEGRATION_TARGET_IDS
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.integration.requiredTargets).toEqual(
        integrationMap.RECRUITMENT_INTEGRATION.requiredTargets
      );
      expect(DEFAULT_RECRUITMENT_CONTEXT.integration.firstAdoptionTarget).toBe("updates");
      expect(DEFAULT_RECRUITMENT_CONTEXT.integration.lastAdoptionTarget).toBe("generator");
      expect(DEFAULT_RECRUITMENT_CONTEXT.integration.firstImplementationPhase).toBe(68);
    });

    test("descriptor lists all foundation phases through integration map", () => {
      expect(RECRUITMENT_CONTEXT_DESCRIPTOR.foundationPhases).toEqual([
        63, 64, 65, 66, 67
      ]);
      expect(DEFAULT_RECRUITMENT_CONTEXT.foundationPhases).toEqual([
        63, 64, 65, 66, 67
      ]);
    });
  });

  describe("immutability", () => {
    test("top-level exported constants are frozen", () => {
      expect(Object.isFrozen(RECRUITMENT_CONTEXT_DESCRIPTOR)).toBe(true);
      expect(Object.isFrozen(RECRUITMENT_CONTEXT_METADATA)).toBe(true);
      expect(Object.isFrozen(DEFAULT_RECRUITMENT_CONTEXT)).toBe(true);
      expect(Object.isFrozen(DOMAIN_CONTEXT_SECTION)).toBe(true);
      expect(Object.isFrozen(LIFECYCLE_CONTEXT_SECTION)).toBe(true);
      expect(Object.isFrozen(IDENTITY_CONTEXT_SECTION)).toBe(true);
      expect(Object.isFrozen(MATCHING_CONTEXT_SECTION)).toBe(true);
      expect(Object.isFrozen(INTEGRATION_CONTEXT_SECTION)).toBe(true);
    });

    test("default context graph is deeply frozen", () => {
      assertAllFrozen(DEFAULT_RECRUITMENT_CONTEXT);
      assertAllFrozen(RECRUITMENT_CONTEXT_DESCRIPTOR);
    });

    test("mutation attempts on default context sections are rejected", () => {
      expect(() => {
        DEFAULT_RECRUITMENT_CONTEXT.domain.lifecycleEventCount = 99;
      }).toThrow();
      expect(DEFAULT_RECRUITMENT_CONTEXT.domain.lifecycleEventCount).toBe(14);
    });

    test("mutation attempts on section vocabulary arrays are rejected", () => {
      expect(() => {
        DOMAIN_CONTEXT_SECTION.lifecycleEventTypes.push("bogus");
      }).toThrow();
      expect(() => {
        INTEGRATION_CONTEXT_SECTION.requiredTargets.push("bogus");
      }).toThrow();
    });

    test("createRecruitmentContext returns frozen customized contexts", () => {
      const customized = createRecruitmentContext({
        label: "test-context",
        metadata: { purpose: "unit-test" }
      });
      assertAllFrozen(customized);
      expect(customized.metadata.label).toBe("test-context");
      expect(customized.metadata.purpose).toBe("unit-test");
    });
  });

  describe("context creation", () => {
    test("createRecruitmentContext with no input returns default context", () => {
      expect(createRecruitmentContext()).toBe(DEFAULT_RECRUITMENT_CONTEXT);
      expect(createRecruitmentContext(null)).toBe(DEFAULT_RECRUITMENT_CONTEXT);
      expect(createRecruitmentContext(undefined)).toBe(DEFAULT_RECRUITMENT_CONTEXT);
    });

    test("createRecruitmentContext rejects non-object input safely", () => {
      expect(createRecruitmentContext("invalid")).toBe(DEFAULT_RECRUITMENT_CONTEXT);
      expect(createRecruitmentContext(42)).toBe(DEFAULT_RECRUITMENT_CONTEXT);
      expect(createRecruitmentContext([])).toBe(DEFAULT_RECRUITMENT_CONTEXT);
    });

    test("createRecruitmentContext with empty object returns default context", () => {
      expect(createRecruitmentContext({})).toBe(DEFAULT_RECRUITMENT_CONTEXT);
    });

    test("createRecruitmentContext with label creates a distinct valid context", () => {
      const ctx = createRecruitmentContext({ label: "advisory-context" });
      expect(ctx).not.toBe(DEFAULT_RECRUITMENT_CONTEXT);
      expect(isRecruitmentContext(ctx)).toBe(true);
      expect(ctx.metadata.customized).toBe(true);
      expect(ctx.metadata.label).toBe("advisory-context");
    });

    test("createRecruitmentContext supports shallow section overrides", () => {
      const ctx = createRecruitmentContext({
        domain: { advisoryNote: "domain override" }
      });
      expect(ctx.domain.advisoryNote).toBe("domain override");
      expect(ctx.domain.phase).toBe(63);
      expect(ctx.domain).not.toBe(DOMAIN_CONTEXT_SECTION);
      expect(isRecruitmentContext(ctx)).toBe(true);
    });

    test("createRecruitmentContext does not mutate default context", () => {
      const before = DEFAULT_RECRUITMENT_CONTEXT.domain.lifecycleEventCount;
      createRecruitmentContext({
        domain: { lifecycleEventCount: 999 }
      });
      expect(DEFAULT_RECRUITMENT_CONTEXT.domain.lifecycleEventCount).toBe(before);
    });
  });

  describe("validation", () => {
    test("isRecruitmentContext accepts default and customized contexts", () => {
      expect(isRecruitmentContext(DEFAULT_RECRUITMENT_CONTEXT)).toBe(true);
      expect(
        isRecruitmentContext(createRecruitmentContext({ label: "validated" }))
      ).toBe(true);
    });

    test("isRecruitmentContext rejects null, primitives, and arrays", () => {
      expect(isRecruitmentContext(null)).toBe(false);
      expect(isRecruitmentContext(undefined)).toBe(false);
      expect(isRecruitmentContext("context")).toBe(false);
      expect(isRecruitmentContext(68)).toBe(false);
      expect(isRecruitmentContext([])).toBe(false);
    });

    test("isRecruitmentContext rejects objects with wrong phase", () => {
      expect(
        isRecruitmentContext({
          ...DEFAULT_RECRUITMENT_CONTEXT,
          phase: 67
        })
      ).toBe(false);
    });

    test("isRecruitmentContext rejects objects missing architecture flags", () => {
      expect(
        isRecruitmentContext({
          ...DEFAULT_RECRUITMENT_CONTEXT,
          contextOnly: false
        })
      ).toBe(false);
      expect(
        isRecruitmentContext({
          ...DEFAULT_RECRUITMENT_CONTEXT,
          runtimeIntegration: true
        })
      ).toBe(false);
    });

    test("isRecruitmentContext rejects objects with malformed sections", () => {
      const malformed = createRecruitmentContext({ label: "malformed-check" });
      const broken = {
        ...malformed,
        domain: { section: "domain", phase: 63 }
      };
      expect(isRecruitmentContext(broken)).toBe(false);
    });
  });

  describe("helper behavior", () => {
    test("summarizeRecruitmentContext returns frozen advisory summary for default context", () => {
      const summary = summarizeRecruitmentContext();
      expect(summary.phase).toBe(68);
      expect(summary.entity).toBe("recruitment_context");
      expect(summary.lifecycleEventCount).toBe(14);
      expect(summary.contractCount).toBe(14);
      expect(summary.signalCount).toBe(9);
      expect(summary.matchSignalCount).toBe(9);
      expect(summary.integrationTargetCount).toBe(7);
      expect(summary.requiredIntegrationTargets).toEqual([
        "updates",
        "worker",
        "persistence"
      ]);
      expect(summary.runtimeIntegration).toBe(false);
      expect(summary.workerIntegration).toBe(false);
      expect(summary.generatorIntegration).toBe(false);
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("summarizeRecruitmentContext falls back to default for invalid input", () => {
      const summary = summarizeRecruitmentContext({ bogus: true });
      expect(summary.phase).toBe(68);
      expect(summary.lifecycleEventCount).toBe(14);
    });

    test("summarizeRecruitmentContext reflects customized contexts", () => {
      const ctx = createRecruitmentContext({
        matching: { matchSignalCount: 10 }
      });
      const summary = summarizeRecruitmentContext(ctx);
      expect(summary.matchSignalCount).toBe(10);
      expect(summary.matchingPhase).toBe(66);
    });
  });

  describe("circular references", () => {
    test("exported context graph has no circular references", () => {
      expect(hasCircularReference(DEFAULT_RECRUITMENT_CONTEXT)).toBe(false);
      expect(hasCircularReference(RECRUITMENT_CONTEXT_DESCRIPTOR)).toBe(false);
      expect(hasCircularReference(DOMAIN_CONTEXT_SECTION)).toBe(false);
      expect(hasCircularReference(INTEGRATION_CONTEXT_SECTION)).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("recruitment context module has no DB / Express / filesystem / env access", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/Phase 68/);
      expect(source).toMatch(/Pure descriptive library/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
    });

    test("recruitment context module has zero require dependencies", () => {
      const source = read(MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
    });

    test("module references foundation vocabulary as strings only — no require imports", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/No imports from other recruitment modules/i);
      expect(source).toMatch(/recruitmentDomainModel/);
      expect(source).toMatch(/recruitmentLifecycleContracts/);
      expect(source).toMatch(/recruitmentIdentityModel/);
      expect(source).toMatch(/recruitmentMatchingContracts/);
      expect(source).toMatch(/recruitmentIntegrationMap/);
      expect(source).not.toMatch(
        /require\(["'].*recruitment(DomainModel|LifecycleContracts|IdentityModel|MatchingContracts|IntegrationMap)/
      );
      expect(source).not.toMatch(/require\(["'].*runRecruitmentPipeline/);
      expect(source).not.toMatch(/require\(["'].*siteWorker/);
    });

    test("module declares no worker or generator integration", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/No worker integration/i);
      expect(source).toMatch(/No generator integration/i);
      expect(source).not.toMatch(/bullmq/i);
      expect(source).not.toMatch(/generatorDraft/);
    });
  });

  describe("no runtime integration", () => {
    test("production modules are unchanged — recruitment context not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/recruitmentContext/);

      const domainModelSource = read("server/lib/recruitment/recruitmentDomainModel.js");
      expect(domainModelSource).not.toMatch(/recruitmentContext/);

      const lifecycleSource = read(
        "server/lib/recruitment/recruitmentLifecycleContracts.js"
      );
      expect(lifecycleSource).not.toMatch(/recruitmentContext/);

      const identitySource = read("server/lib/recruitment/recruitmentIdentityModel.js");
      expect(identitySource).not.toMatch(/recruitmentContext/);

      const matchingSource = read(
        "server/lib/recruitment/recruitmentMatchingContracts.js"
      );
      expect(matchingSource).not.toMatch(/recruitmentContext/);

      const integrationSource = read(
        "server/lib/recruitment/recruitmentIntegrationMap.js"
      );
      expect(integrationSource).not.toMatch(/recruitmentContext/);
    });

    test("runtime, capability, and diagnostics modules do not import recruitment context", () => {
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
        expect(read(relPath)).not.toMatch(/recruitmentContext/);
      }
    });

    test("runRecruitmentPipeline imports compatibility layer but not recruitment context directly", () => {
      const pipeline = read("server/lib/recruitment/runRecruitmentPipeline.js");
      expect(pipeline).toMatch(/recruitmentCompatibilityLayer/);
      expect(pipeline).not.toMatch(/recruitmentContext/);
    });

    test("generator and pages services do not import recruitment context", () => {
      const modules = [
        "server/services/generatorDraft.service.js",
        "server/services/page.service.js",
        "server/services/recruitmentPageLink.service.js",
        "server/services/updates/updates.repository.js"
      ];
      for (const relPath of modules) {
        expect(read(relPath)).not.toMatch(/recruitmentContext/);
      }
    });

    test("default context metadata confirms architecture-only posture", () => {
      expect(DEFAULT_RECRUITMENT_CONTEXT.runtimeIntegration).toBe(false);
      expect(DEFAULT_RECRUITMENT_CONTEXT.persistenceEnabled).toBe(false);
      expect(DEFAULT_RECRUITMENT_CONTEXT.sideEffects).toBe(false);
      expect(DEFAULT_RECRUITMENT_CONTEXT.metadata.workerIntegration).toBe(false);
      expect(DEFAULT_RECRUITMENT_CONTEXT.metadata.generatorIntegration).toBe(false);
      expect(DEFAULT_RECRUITMENT_CONTEXT.matching.scoreCalculation).toBe(false);
      expect(DEFAULT_RECRUITMENT_CONTEXT.matching.matchingExecution).toBe(false);
      expect(DEFAULT_RECRUITMENT_CONTEXT.lifecycle.transitionAdvisoryOnly).toBe(true);
    });
  });
});
