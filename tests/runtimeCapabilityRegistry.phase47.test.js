"use strict";

/**
 * Phase 47 — Runtime Capability Registry tests.
 * Architecture only: descriptive catalog — no I/O, persistence, or logging.
 */

const fs = require("fs");
const path = require("path");

const {
  CAPABILITY_REGISTRY_PHASE,
  CAPABILITY_IDS,
  SUPPORTED_CAPABILITY_IDS,
  REQUIRED_CAPABILITY_FIELDS,
  REQUIRED_REGISTRY_FIELDS,
  CAPABILITY_VALIDATION_REASONS,
  CANONICAL_CAPABILITY_DEFINITIONS,
  createCapabilityRegistry,
  listCapabilities,
  getCapability,
  hasCapability,
  isCapabilityAvailable,
  isCapabilityWired,
  isProductionReady,
  validateCapabilityRegistry,
  summarizeCapabilityRegistry,
  isSupportedCapabilityId,
  isCapabilityRegistryArchitectureOnly
} = require("../server/lib/recruitment/runtimeCapabilityRegistry");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assertRegistryShell(registry) {
  expect(registry.architectureOnly).toBe(true);
  expect(registry.advisory).toBe(true);
  expect(registry.phase).toBe(CAPABILITY_REGISTRY_PHASE);
  expect(Array.isArray(registry.capabilities)).toBe(true);
  expect(registry.metadata).toEqual(
    expect.objectContaining({
      phase: CAPABILITY_REGISTRY_PHASE,
      sideEffects: false,
      architectureOnly: true,
      advisory: true,
      executed: false,
      persistenceEnabled: false,
      automationEnabled: false,
      queueEnqueueEnabled: false,
      repositoriesInvoked: false,
      transactionBegun: false,
      transactionCommitted: false,
      transactionRolledBack: false,
      consoleLogging: false,
      fileWrites: false,
      databaseWrites: false
    })
  );
  expect(isCapabilityRegistryArchitectureOnly(registry)).toBe(true);
}

function baseCapability(overrides = {}) {
  return {
    id: "custom_capability",
    name: "Custom Capability",
    phase: 99,
    description: "test capability",
    available: true,
    wired: false,
    enabled: false,
    architectureOnly: true,
    productionReady: false,
    dependencies: [],
    ...overrides
  };
}

describe("Phase 47 — runtimeCapabilityRegistry", () => {
  describe("constants", () => {
    test("exposes frozen ids, fields, reasons, and phase", () => {
      expect(CAPABILITY_REGISTRY_PHASE).toBe(47);
      expect(CAPABILITY_IDS).toEqual({
        PERSISTENCE_POLICY: "persistence_policy",
        RUNTIME_PERSISTENCE_SERVICE: "runtime_persistence_service",
        REPOSITORY_CONTRACTS: "repository_contracts",
        MYSQL_REPOSITORY_ADAPTERS: "mysql_repository_adapters",
        EXECUTION_PIPELINE: "execution_pipeline",
        TRANSACTION_COORDINATOR: "transaction_coordinator",
        AUDIT_TRAIL: "audit_trail",
        EXECUTION_CONTEXT: "execution_context",
        PREVIEW_RUNTIME_WIRING: "preview_runtime_wiring",
        DRY_RUN_SIMULATOR: "dry_run_simulator",
        REVIEW_WORKFLOW: "review_workflow",
        PERSISTENCE_ENABLEMENT: "persistence_enablement",
        CONTROLLED_EXECUTION_ADAPTER: "controlled_execution_adapter",
        EXECUTION_DIAGNOSTICS: "execution_diagnostics"
      });
      expect([...SUPPORTED_CAPABILITY_IDS].sort()).toEqual(
        Object.values(CAPABILITY_IDS).slice().sort()
      );
      expect(REQUIRED_CAPABILITY_FIELDS).toEqual([
        "id",
        "name",
        "phase",
        "description",
        "available",
        "wired",
        "enabled",
        "architectureOnly",
        "productionReady",
        "dependencies"
      ]);
      expect(REQUIRED_REGISTRY_FIELDS).toEqual(
        expect.arrayContaining([
          "phase",
          "capabilities",
          "architectureOnly",
          "advisory",
          "metadata"
        ])
      );
      expect(CAPABILITY_VALIDATION_REASONS).toEqual({
        VALID: "VALID",
        INVALID_INPUT: "INVALID_INPUT",
        MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
        INVALID_FIELD: "INVALID_FIELD",
        DUPLICATE_CAPABILITY_ID: "DUPLICATE_CAPABILITY_ID",
        UNKNOWN_DEPENDENCY: "UNKNOWN_DEPENDENCY",
        SELF_DEPENDENCY: "SELF_DEPENDENCY",
        REGISTRY_NOT_ARCHITECTURE_ONLY: "REGISTRY_NOT_ARCHITECTURE_ONLY"
      });
      expect(Object.isFrozen(CAPABILITY_IDS)).toBe(true);
      expect(Object.isFrozen(SUPPORTED_CAPABILITY_IDS)).toBe(true);
      expect(Object.isFrozen(REQUIRED_CAPABILITY_FIELDS)).toBe(true);
      expect(Object.isFrozen(REQUIRED_REGISTRY_FIELDS)).toBe(true);
      expect(Object.isFrozen(CAPABILITY_VALIDATION_REASONS)).toBe(true);
      expect(Object.isFrozen(CANONICAL_CAPABILITY_DEFINITIONS)).toBe(true);
    });

    test("isSupportedCapabilityId recognizes canonical ids", () => {
      expect(isSupportedCapabilityId("persistence_policy")).toBe(true);
      expect(isSupportedCapabilityId("EXECUTION_DIAGNOSTICS")).toBe(true);
      expect(isSupportedCapabilityId("execution_diagnostics")).toBe(true);
      expect(isSupportedCapabilityId("unknown")).toBe(false);
      expect(isSupportedCapabilityId(null)).toBe(false);
    });
  });

  describe("registry creation", () => {
    test("createCapabilityRegistry returns frozen canonical catalog", () => {
      const registry = createCapabilityRegistry();
      assertRegistryShell(registry);
      expect(Object.isFrozen(registry)).toBe(true);
      expect(Object.isFrozen(registry.capabilities)).toBe(true);
      expect(Object.isFrozen(registry.metadata)).toBe(true);
      expect(registry.capabilities).toHaveLength(14);
      expect(registry.capabilities.map((c) => c.phase)).toEqual([
        33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46
      ]);
      for (const capability of registry.capabilities) {
        expect(Object.isFrozen(capability)).toBe(true);
        expect(Object.isFrozen(capability.dependencies)).toBe(true);
        expect(capability.architectureOnly).toBe(true);
        expect(capability.enabled).toBe(false);
        expect(capability.productionReady).toBe(false);
        expect(capability.available).toBe(true);
      }
    });

    test("createCapabilityRegistry ignores unsafe option overrides", () => {
      const registry = createCapabilityRegistry({
        metadata: {
          executed: true,
          persistenceEnabled: true,
          sideEffects: true,
          phase: 1
        },
        capabilities: [
          baseCapability({
            id: "safe_test",
            enabled: true,
            productionReady: true,
            architectureOnly: false
          })
        ]
      });
      expect(registry.metadata.executed).toBe(false);
      expect(registry.metadata.persistenceEnabled).toBe(false);
      expect(registry.metadata.sideEffects).toBe(false);
      expect(registry.metadata.phase).toBe(47);
      expect(registry.capabilities[0].enabled).toBe(false);
      expect(registry.capabilities[0].productionReady).toBe(false);
      expect(registry.capabilities[0].architectureOnly).toBe(true);
    });

    test("null/undefined options still produce canonical registry", () => {
      expect(createCapabilityRegistry(null).capabilities).toHaveLength(14);
      expect(createCapabilityRegistry(undefined).capabilities).toHaveLength(14);
    });
  });

  describe("capability lookup and list operations", () => {
    test("listCapabilities returns phase-ordered clones for default registry", () => {
      const listed = listCapabilities();
      expect(listed).toHaveLength(14);
      expect(listed.map((c) => c.id)).toEqual([
        "persistence_policy",
        "runtime_persistence_service",
        "repository_contracts",
        "mysql_repository_adapters",
        "execution_pipeline",
        "transaction_coordinator",
        "audit_trail",
        "execution_context",
        "preview_runtime_wiring",
        "dry_run_simulator",
        "review_workflow",
        "persistence_enablement",
        "controlled_execution_adapter",
        "execution_diagnostics"
      ]);
      expect(listed.map((c) => c.phase)).toEqual([
        33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46
      ]);
    });

    test("getCapability supports registry+id and id-only forms", () => {
      const registry = createCapabilityRegistry();
      const viaRegistry = getCapability(
        registry,
        CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING
      );
      const viaId = getCapability(CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING);
      expect(viaRegistry).not.toBeNull();
      expect(viaId).not.toBeNull();
      expect(viaRegistry.id).toBe("preview_runtime_wiring");
      expect(viaId.name).toBe("Preview-First Runtime Wiring");
      expect(viaRegistry.phase).toBe(41);
      expect(getCapability(registry, "missing")).toBeNull();
      expect(getCapability("missing")).toBeNull();
      expect(getCapability(registry, null)).toBeNull();
      expect(getCapability(null, CAPABILITY_IDS.AUDIT_TRAIL).id).toBe(
        "audit_trail"
      );
    });

    test("hasCapability / availability / wiring / productionReady helpers", () => {
      const registry = createCapabilityRegistry();

      expect(hasCapability(registry, "persistence_policy")).toBe(true);
      expect(hasCapability("execution_diagnostics")).toBe(true);
      expect(hasCapability(registry, "nope")).toBe(false);

      expect(isCapabilityAvailable(registry, "persistence_policy")).toBe(true);
      expect(isCapabilityAvailable("mysql_repository_adapters")).toBe(true);
      expect(isCapabilityAvailable(registry, "nope")).toBe(false);

      expect(isCapabilityWired(registry, "preview_runtime_wiring")).toBe(true);
      expect(isCapabilityWired(registry, "execution_context")).toBe(true);
      expect(isCapabilityWired(registry, "dry_run_simulator")).toBe(false);
      expect(isCapabilityWired(registry, "execution_diagnostics")).toBe(false);
      expect(isCapabilityWired(registry, "nope")).toBe(false);

      expect(isProductionReady(registry, "persistence_policy")).toBe(false);
      expect(isProductionReady("controlled_execution_adapter")).toBe(false);
      expect(isProductionReady(registry, "nope")).toBe(false);
    });

    test("capability model includes required descriptive fields", () => {
      const capability = getCapability(CAPABILITY_IDS.CONTROLLED_EXECUTION_ADAPTER);
      for (const field of REQUIRED_CAPABILITY_FIELDS) {
        expect(capability).toHaveProperty(field);
      }
      expect(capability.dependencies).toEqual(
        expect.arrayContaining([
          "execution_context",
          "persistence_policy",
          "persistence_enablement",
          "execution_pipeline",
          "transaction_coordinator"
        ])
      );
      expect([...capability.dependencies]).toEqual(
        [...capability.dependencies].sort()
      );
    });
  });

  describe("validation", () => {
    test("canonical registry validates successfully", () => {
      const result = validateCapabilityRegistry(createCapabilityRegistry());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.reasons).toEqual([CAPABILITY_VALIDATION_REASONS.VALID]);
    });

    test("rejects non-object registry input", () => {
      expect(validateCapabilityRegistry(null)).toEqual({
        valid: false,
        errors: ["registry must be a plain object"],
        reasons: [CAPABILITY_VALIDATION_REASONS.INVALID_INPUT]
      });
      expect(validateCapabilityRegistry("nope").valid).toBe(false);
    });

    test("detects duplicate capability ids", () => {
      const registry = {
        phase: 47,
        architectureOnly: true,
        advisory: true,
        metadata: {
          phase: 47,
          sideEffects: false,
          architectureOnly: true,
          executed: false,
          persistenceEnabled: false
        },
        capabilities: [
          baseCapability({ id: "dup_a" }),
          baseCapability({ id: "dup_a", name: "Duplicate" })
        ]
      };
      const result = validateCapabilityRegistry(registry);
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(
        CAPABILITY_VALIDATION_REASONS.DUPLICATE_CAPABILITY_ID
      );
      expect(result.errors.some((e) => /duplicate capability id/.test(e))).toBe(
        true
      );
    });

    test("detects unknown and self dependencies", () => {
      const unknownDeps = {
        phase: 47,
        architectureOnly: true,
        advisory: true,
        metadata: {
          phase: 47,
          sideEffects: false,
          architectureOnly: true,
          executed: false,
          persistenceEnabled: false
        },
        capabilities: [
          baseCapability({
            id: "cap_a",
            dependencies: ["does_not_exist"]
          })
        ]
      };
      const unknownResult = validateCapabilityRegistry(unknownDeps);
      expect(unknownResult.valid).toBe(false);
      expect(unknownResult.reasons).toContain(
        CAPABILITY_VALIDATION_REASONS.UNKNOWN_DEPENDENCY
      );

      const selfDeps = {
        phase: 47,
        architectureOnly: true,
        advisory: true,
        metadata: {
          phase: 47,
          sideEffects: false,
          architectureOnly: true,
          executed: false,
          persistenceEnabled: false
        },
        capabilities: [
          baseCapability({
            id: "cap_self",
            dependencies: ["cap_self"]
          })
        ]
      };
      const selfResult = validateCapabilityRegistry(selfDeps);
      expect(selfResult.valid).toBe(false);
      expect(selfResult.reasons).toContain(
        CAPABILITY_VALIDATION_REASONS.SELF_DEPENDENCY
      );
    });

    test("rejects enabled or productionReady capabilities", () => {
      const registry = {
        phase: 47,
        architectureOnly: true,
        advisory: true,
        metadata: {
          phase: 47,
          sideEffects: false,
          architectureOnly: true,
          executed: false,
          persistenceEnabled: false
        },
        capabilities: [
          baseCapability({ id: "live_cap", enabled: true }),
          baseCapability({ id: "prod_cap", productionReady: true })
        ]
      };
      const result = validateCapabilityRegistry(registry);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => /enabled must be false/.test(e))
      ).toBe(true);
      expect(
        result.errors.some((e) => /productionReady must be false/.test(e))
      ).toBe(true);
    });

    test("rejects non-architecture-only registry", () => {
      const registry = {
        ...createCapabilityRegistry(),
        architectureOnly: false
      };
      const result = validateCapabilityRegistry(registry);
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain(
        CAPABILITY_VALIDATION_REASONS.REGISTRY_NOT_ARCHITECTURE_ONLY
      );
    });
  });

  describe("summary", () => {
    test("summarizeCapabilityRegistry reports catalog totals", () => {
      const summary = summarizeCapabilityRegistry(createCapabilityRegistry());
      expect(summary.phase).toBe(47);
      expect(summary.totalCapabilities).toBe(14);
      expect(summary.availableCount).toBe(14);
      expect(summary.wiredCount).toBe(7);
      expect(summary.enabledCount).toBe(0);
      expect(summary.architectureOnlyCount).toBe(14);
      expect(summary.productionReadyCount).toBe(0);
      expect(summary.phases).toEqual([
        33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46
      ]);
      expect(summary.capabilityIds).toHaveLength(14);
      expect(summary.architectureOnly).toBe(true);
      expect(summary.executed).toBe(false);
      expect(summary.sideEffects).toBe(false);
      expect(summary.persistenceEnabled).toBe(false);
      expect(summary.reason).toBe("ARCHITECTURE_ONLY_REGISTRY");
      expect(Object.isFrozen(summary)).toBe(true);
    });
  });

  describe("deterministic behavior and non-mutation", () => {
    test("repeated creation yields identical capability snapshots", () => {
      const first = createCapabilityRegistry();
      const second = createCapabilityRegistry();
      expect(listCapabilities(first)).toEqual(listCapabilities(second));
      expect(summarizeCapabilityRegistry(first)).toEqual(
        summarizeCapabilityRegistry(second)
      );
      expect(validateCapabilityRegistry(first)).toEqual(
        validateCapabilityRegistry(second)
      );
    });

    test("returned capabilities are clones — mutations do not leak", () => {
      const registry = createCapabilityRegistry();
      const listed = listCapabilities(registry);
      const capability = getCapability(
        registry,
        CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING
      );

      listed[0].enabled = true;
      listed[0].dependencies.push("LEAK");
      capability.wired = false;
      capability.dependencies.push("LEAK");

      const again = getCapability(
        registry,
        CAPABILITY_IDS.PREVIEW_RUNTIME_WIRING
      );
      expect(again.enabled).toBe(false);
      expect(again.wired).toBe(true);
      expect(again.dependencies).not.toContain("LEAK");
      expect(registry.capabilities[0].enabled).toBe(false);
      expect(
        getCapability(CAPABILITY_IDS.PERSISTENCE_POLICY).dependencies
      ).not.toContain("LEAK");
    });

    test("registry object itself is immutable where practical", () => {
      const registry = createCapabilityRegistry();
      expect(() => {
        registry.phase = 1;
      }).toThrow();
      expect(() => {
        registry.capabilities.push(baseCapability());
      }).toThrow();
      expect(() => {
        registry.metadata.executed = true;
      }).toThrow();
      expect(() => {
        registry.capabilities[0].enabled = true;
      }).toThrow();
    });
  });

  describe("architecture boundaries (source)", () => {
    test("registry module never performs I/O or persistence side effects", () => {
      const source = read("server/lib/recruitment/runtimeCapabilityRegistry.js");
      expect(source).toMatch(/Phase 47/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never enables execution/);
      expect(source).toMatch(/Never modifies runtime/);
      expect(source).toMatch(/Never writes to database/);
      expect(source).toMatch(/Never writes files/);
      expect(source).toMatch(/Never uses console logging/);
      expect(source).toMatch(/Never modifies workers/);
      expect(source).toMatch(/Never enables persistence/);
      expect(source).toMatch(/Never enables review queues/);
      expect(source).toMatch(/Never calls repositories/);
      expect(source).toMatch(/Never starts transactions/);
      expect(source).toMatch(/Never enqueues queues/);
      expect(source).not.toMatch(/createPool|INSERT INTO|createConnection/i);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/bull|bee-queue|agenda/i);
      expect(source).not.toMatch(/saveReviewItem|recruitmentReview/);
      expect(source).not.toMatch(/repositories\//);
      expect(source).not.toMatch(/require\(["'].*db["']\)/);
      expect(source).not.toMatch(/mysqlPersistenceRepositoryAdapters/);
      expect(source).not.toMatch(/createMysql/);
      expect(source).not.toMatch(/executeRuntimePersistence/);
      expect(source).not.toMatch(/simulateDryRunPersistence/);
      expect(source).not.toMatch(/previewRuntimeWiring/);
      expect(source).not.toMatch(/controlledRuntimeExecutionAdapter/);
      expect(source).not.toMatch(/executionDiagnostics/);
      expect(source).not.toMatch(/siteWorker/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/console\.(log|info|warn|error|debug)/);
      expect(source).not.toMatch(/require\(/);
      expect(source).toMatch(/enabled: false/);
      expect(source).toMatch(/productionReady: false/);
      expect(source).toMatch(/persistenceEnabled: false/);
      expect(source).toMatch(/consoleLogging: false/);
      expect(source).toMatch(/databaseWrites: false/);
    });

    test("siteWorker is unchanged — capability registry not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/runtimeCapabilityRegistry/);
      expect(worker).not.toMatch(/createCapabilityRegistry/);
      expect(worker).not.toMatch(/listCapabilities/);
      expect(worker).not.toMatch(/summarizeCapabilityRegistry/);
    });

    test("prior modules do not import the capability registry", () => {
      const files = [
        "server/lib/recruitment/runtimePersistencePolicy.js",
        "server/lib/recruitment/runtimePersistenceService.js",
        "server/lib/recruitment/persistenceRepositoryContracts.js",
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js",
        "server/lib/recruitment/persistenceExecutionPipeline.js",
        "server/lib/recruitment/transactionCoordinator.js",
        "server/lib/recruitment/auditTrail.js",
        "server/lib/recruitment/executionContext.js",
        "server/lib/recruitment/dryRunPersistenceSimulator.js",
        "server/lib/recruitment/reviewWorkflow.js",
        "server/lib/recruitment/persistenceEnablement.js",
        "server/lib/recruitment/controlledRuntimeExecutionAdapter.js",
        "server/lib/recruitment/executionDiagnostics.js",
        "server/lib/recruitment/runtimePreviewBuffer.js",
        "server/lib/recruitment/reviewQueue.js",
        "server/config/recruitmentPipeline.js",
        "server/config/recruitmentLifecycle.js"
      ];
      for (const rel of files) {
        const source = read(rel);
        expect(source).not.toMatch(/runtimeCapabilityRegistry/);
        expect(source).not.toMatch(/createCapabilityRegistry/);
        expect(source).not.toMatch(/listCapabilities/);
        expect(source).not.toMatch(/summarizeCapabilityRegistry/);
      }
    });

    test("prior phase modules are unchanged by this phase", () => {
      const files = {
        "server/lib/recruitment/runtimePersistencePolicy.js": /Phase 33/,
        "server/lib/recruitment/runtimePersistenceService.js": /Phase 34/,
        "server/lib/recruitment/persistenceRepositoryContracts.js": /Phase 35/,
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js":
          /Phase 36/,
        "server/lib/recruitment/persistenceExecutionPipeline.js": /Phase 37/,
        "server/lib/recruitment/transactionCoordinator.js": /Phase 38/,
        "server/lib/recruitment/auditTrail.js": /Phase 39/,
        "server/lib/recruitment/executionContext.js": /Phase 40/,
        "server/lib/recruitment/previewRuntimeWiring.js": /Phase 41/,
        "server/lib/recruitment/dryRunPersistenceSimulator.js": /Phase 42/,
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/,
        "server/lib/recruitment/persistenceEnablement.js": /Phase 44/,
        "server/lib/recruitment/controlledRuntimeExecutionAdapter.js":
          /Phase 45/,
        "server/lib/recruitment/executionDiagnostics.js": /Phase 46/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 47/);
      }
    });

    test("all public paths remain architecture-only and non-executing", () => {
      const registry = createCapabilityRegistry();
      const listed = listCapabilities(registry);
      const summary = summarizeCapabilityRegistry(registry);
      const samples = [
        registry,
        createCapabilityRegistry(null),
        createCapabilityRegistry({ metadata: { executed: true } })
      ];

      for (const sample of samples) {
        expect(sample.architectureOnly).toBe(true);
        expect(sample.advisory).toBe(true);
        expect(sample.metadata.executed).toBe(false);
        expect(sample.metadata.persistenceEnabled).toBe(false);
        expect(sample.metadata.sideEffects).toBe(false);
        expect(sample.metadata.consoleLogging).toBe(false);
        expect(sample.metadata.fileWrites).toBe(false);
        expect(sample.metadata.databaseWrites).toBe(false);
        expect(isCapabilityRegistryArchitectureOnly(sample)).toBe(true);
      }

      for (const capability of listed) {
        expect(capability.enabled).toBe(false);
        expect(capability.architectureOnly).toBe(true);
        expect(capability.productionReady).toBe(false);
      }

      expect(summary.executed).toBe(false);
      expect(summary.architectureOnly).toBe(true);
      expect(summary.persistenceEnabled).toBe(false);
      expect(summary.enabledCount).toBe(0);
      expect(summary.productionReadyCount).toBe(0);
      expect(isProductionReady(registry, "preview_runtime_wiring")).toBe(false);
    });
  });
});
