"use strict";

/**
 * Phase 44 — Feature Flagged Persistence Enablement Framework tests.
 * Architecture only: advisory allow/block decisions — no enablement.
 */

const fs = require("fs");
const path = require("path");

const {
  ENABLEMENT_PHASE,
  EXECUTION_MODES,
  SUPPORTED_EXECUTION_MODES,
  ENABLEMENT_CAPABILITIES,
  ENABLEMENT_REASONS,
  DEFAULT_FEATURE_FLAGS,
  createDefaultEnablementConfig,
  resolveFeatureState,
  validateEnablementConfig,
  evaluatePersistenceEnablement,
  isPersistenceEnablementArchitectureOnly
} = require("../server/lib/recruitment/persistenceEnablement");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function baseConfig(overrides = {}) {
  const defaults = createDefaultEnablementConfig();
  const { featureFlags: flagOverrides, ...rest } = overrides;
  return {
    ...defaults,
    ...rest,
    featureFlags: {
      ...defaults.featureFlags,
      ...(flagOverrides || {})
    }
  };
}

describe("Phase 44 — persistenceEnablement", () => {
  describe("constants", () => {
    test("exposes frozen modes, capabilities, reasons, and phase", () => {
      expect(ENABLEMENT_PHASE).toBe(44);
      expect(EXECUTION_MODES).toEqual({
        PREVIEW: "preview",
        DRY_RUN: "dry_run",
        LIVE: "live"
      });
      expect([...SUPPORTED_EXECUTION_MODES].sort()).toEqual([
        "dry_run",
        "live",
        "preview"
      ]);
      expect(ENABLEMENT_CAPABILITIES).toEqual({
        PERSISTENCE: "persistence",
        REVIEW_ENQUEUE: "review_enqueue",
        BOTH: "both"
      });
      expect(ENABLEMENT_REASONS).toEqual({
        VALID: "VALID",
        INVALID_CONFIGURATION: "INVALID_CONFIGURATION",
        INVALID_EXECUTION_MODE: "INVALID_EXECUTION_MODE",
        INVALID_FEATURE_FLAGS: "INVALID_FEATURE_FLAGS",
        INVALID_CAPABILITY: "INVALID_CAPABILITY",
        PIPELINE_DISABLED: "PIPELINE_DISABLED",
        AUTOMATION_DISABLED: "AUTOMATION_DISABLED",
        REVIEW_ENQUEUE_DISABLED: "REVIEW_ENQUEUE_DISABLED",
        PREVIEW_MODE: "PREVIEW_MODE",
        DRY_RUN_MODE: "DRY_RUN_MODE",
        LIVE_MODE_SAFETY_BLOCK: "LIVE_MODE_SAFETY_BLOCK",
        PERSISTENCE_ALLOWED: "PERSISTENCE_ALLOWED",
        REVIEW_ENQUEUE_ALLOWED: "REVIEW_ENQUEUE_ALLOWED",
        SAFE_DEFAULT_DISABLED: "SAFE_DEFAULT_DISABLED"
      });
      expect(DEFAULT_FEATURE_FLAGS).toEqual({
        pipelineEnabled: true,
        automaticPersistenceEnabled: false,
        reviewQueueEnqueueEnabled: false
      });
      expect(Object.isFrozen(EXECUTION_MODES)).toBe(true);
      expect(Object.isFrozen(ENABLEMENT_CAPABILITIES)).toBe(true);
      expect(Object.isFrozen(ENABLEMENT_REASONS)).toBe(true);
      expect(Object.isFrozen(DEFAULT_FEATURE_FLAGS)).toBe(true);
      expect(Object.isFrozen(SUPPORTED_EXECUTION_MODES)).toBe(true);
    });
  });

  describe("default disabled configuration", () => {
    test("createDefaultEnablementConfig is fail-safe disabled", () => {
      const config = createDefaultEnablementConfig();
      expect(config.executionMode).toBe(EXECUTION_MODES.LIVE);
      expect(config.featureFlags.automaticPersistenceEnabled).toBe(false);
      expect(config.featureFlags.reviewQueueEnqueueEnabled).toBe(false);
      expect(config.featureFlags.pipelineEnabled).toBe(true);
      expect(config.capability).toBe(ENABLEMENT_CAPABILITIES.BOTH);
    });

    test("default live config blocks persistence and review enqueue", () => {
      const decision = evaluatePersistenceEnablement(
        createDefaultEnablementConfig()
      );
      expect(decision.allowed).toBe(false);
      expect(decision.blocked).toBe(true);
      expect(decision.executionMode).toBe(EXECUTION_MODES.LIVE);
      expect(decision.featureState).toEqual({
        pipelineEnabled: true,
        automaticPersistenceEnabled: false,
        reviewQueueEnqueueEnabled: false
      });
      expect(decision.persistence.allowed).toBe(false);
      expect(decision.persistence.blocked).toBe(true);
      expect(decision.persistence.reasons).toEqual(
        expect.arrayContaining([
          ENABLEMENT_REASONS.AUTOMATION_DISABLED,
          ENABLEMENT_REASONS.LIVE_MODE_SAFETY_BLOCK,
          ENABLEMENT_REASONS.SAFE_DEFAULT_DISABLED
        ])
      );
      expect(decision.reviewEnqueue.allowed).toBe(false);
      expect(decision.reviewEnqueue.blocked).toBe(true);
      expect(decision.reviewEnqueue.reasons).toEqual(
        expect.arrayContaining([
          ENABLEMENT_REASONS.REVIEW_ENQUEUE_DISABLED,
          ENABLEMENT_REASONS.LIVE_MODE_SAFETY_BLOCK,
          ENABLEMENT_REASONS.SAFE_DEFAULT_DISABLED
        ])
      );
      expect(decision.architectureOnly).toBe(true);
      expect(decision.executed).toBe(false);
      expect(decision.advisory).toBe(true);
      expect(decision.metadata.persistenceEnabled).toBe(false);
      expect(decision.metadata.automationEnabled).toBe(false);
      expect(decision.metadata.queueEnqueueEnabled).toBe(false);
      expect(decision.metadata.wouldEnablePersistence).toBe(false);
      expect(decision.metadata.wouldEnableReviewEnqueue).toBe(false);
      expect(isPersistenceEnablementArchitectureOnly(decision)).toBe(true);
    });

    test("omitted feature flags resolve to fail-safe defaults", () => {
      const decision = evaluatePersistenceEnablement({
        executionMode: EXECUTION_MODES.LIVE
      });
      expect(decision.featureState).toEqual({
        pipelineEnabled: true,
        automaticPersistenceEnabled: false,
        reviewQueueEnqueueEnabled: false
      });
      expect(decision.blocked).toBe(true);
      expect(resolveFeatureState(undefined)).toEqual(DEFAULT_FEATURE_FLAGS);
      expect(resolveFeatureState(null)).toEqual(DEFAULT_FEATURE_FLAGS);
      expect(resolveFeatureState({})).toEqual(DEFAULT_FEATURE_FLAGS);
    });
  });

  describe("preview mode", () => {
    test("blocks persistence and review enqueue with PREVIEW_MODE", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({
          executionMode: EXECUTION_MODES.PREVIEW,
          featureFlags: {
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(decision.executionMode).toBe(EXECUTION_MODES.PREVIEW);
      expect(decision.allowed).toBe(false);
      expect(decision.blocked).toBe(true);
      expect(decision.persistence.allowed).toBe(false);
      expect(decision.persistence.reasons).toEqual([
        ENABLEMENT_REASONS.PREVIEW_MODE
      ]);
      expect(decision.reviewEnqueue.allowed).toBe(false);
      expect(decision.reviewEnqueue.reasons).toEqual([
        ENABLEMENT_REASONS.PREVIEW_MODE
      ]);
      expect(decision.reasons).toEqual([ENABLEMENT_REASONS.PREVIEW_MODE]);
      expect(decision.metadata.persistenceEnabled).toBe(false);
      expect(decision.executed).toBe(false);
    });

    test("normalizes Preview casing", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({ executionMode: " Preview " })
      );
      expect(decision.executionMode).toBe(EXECUTION_MODES.PREVIEW);
      expect(decision.persistence.reasons).toContain(
        ENABLEMENT_REASONS.PREVIEW_MODE
      );
    });
  });

  describe("dry-run mode", () => {
    test("blocks persistence and review enqueue with DRY_RUN_MODE", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({
          executionMode: EXECUTION_MODES.DRY_RUN,
          featureFlags: {
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(decision.executionMode).toBe(EXECUTION_MODES.DRY_RUN);
      expect(decision.allowed).toBe(false);
      expect(decision.blocked).toBe(true);
      expect(decision.persistence.reasons).toEqual([
        ENABLEMENT_REASONS.DRY_RUN_MODE
      ]);
      expect(decision.reviewEnqueue.reasons).toEqual([
        ENABLEMENT_REASONS.DRY_RUN_MODE
      ]);
      expect(decision.metadata.wouldEnablePersistence).toBe(false);
      expect(decision.metadata.wouldEnableReviewEnqueue).toBe(false);
      expect(decision.architectureOnly).toBe(true);
    });
  });

  describe("live mode safety blocking", () => {
    test("live with flags off is safety-blocked", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({ executionMode: EXECUTION_MODES.LIVE })
      );
      expect(decision.blocked).toBe(true);
      expect(decision.persistence.reasons).toEqual(
        expect.arrayContaining([
          ENABLEMENT_REASONS.LIVE_MODE_SAFETY_BLOCK,
          ENABLEMENT_REASONS.AUTOMATION_DISABLED
        ])
      );
      expect(decision.reviewEnqueue.reasons).toEqual(
        expect.arrayContaining([
          ENABLEMENT_REASONS.LIVE_MODE_SAFETY_BLOCK,
          ENABLEMENT_REASONS.REVIEW_ENQUEUE_DISABLED
        ])
      );
      expect(decision.metadata.persistenceEnabled).toBe(false);
      expect(decision.metadata.automationEnabled).toBe(false);
      expect(decision.metadata.queueEnqueueEnabled).toBe(false);
    });

    test("live advisory allow for persistence still never enables persistence", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({
          executionMode: EXECUTION_MODES.LIVE,
          capability: ENABLEMENT_CAPABILITIES.PERSISTENCE,
          featureFlags: {
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: false
          }
        })
      );
      expect(decision.persistence.allowed).toBe(true);
      expect(decision.persistence.reasons).toEqual([
        ENABLEMENT_REASONS.PERSISTENCE_ALLOWED
      ]);
      expect(decision.allowed).toBe(true);
      expect(decision.reviewEnqueue.allowed).toBe(false);
      expect(decision.executed).toBe(false);
      expect(decision.metadata.persistenceEnabled).toBe(false);
      expect(decision.metadata.automationEnabled).toBe(false);
      expect(decision.metadata.wouldEnablePersistence).toBe(true);
      expect(decision.metadata.wouldEnableReviewEnqueue).toBe(false);
      expect(isPersistenceEnablementArchitectureOnly(decision)).toBe(true);
    });

    test("live advisory allow for review enqueue still never enables queues", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({
          executionMode: EXECUTION_MODES.LIVE,
          capability: ENABLEMENT_CAPABILITIES.REVIEW_ENQUEUE,
          featureFlags: {
            automaticPersistenceEnabled: false,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(decision.reviewEnqueue.allowed).toBe(true);
      expect(decision.reviewEnqueue.reasons).toEqual([
        ENABLEMENT_REASONS.REVIEW_ENQUEUE_ALLOWED
      ]);
      expect(decision.allowed).toBe(true);
      expect(decision.persistence.allowed).toBe(false);
      expect(decision.metadata.queueEnqueueEnabled).toBe(false);
      expect(decision.metadata.wouldEnableReviewEnqueue).toBe(true);
    });
  });

  describe("feature flag combinations", () => {
    test("pipeline disabled blocks both capabilities in live", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({
          featureFlags: {
            pipelineEnabled: false,
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(decision.allowed).toBe(false);
      expect(decision.persistence.reasons).toEqual([
        ENABLEMENT_REASONS.PIPELINE_DISABLED
      ]);
      expect(decision.reviewEnqueue.reasons).toEqual([
        ENABLEMENT_REASONS.PIPELINE_DISABLED
      ]);
    });

    test("both flags true in live allows both when capability is both", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({
          featureFlags: {
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: true
          }
        })
      );
      expect(decision.allowed).toBe(true);
      expect(decision.blocked).toBe(false);
      expect(decision.persistence.allowed).toBe(true);
      expect(decision.reviewEnqueue.allowed).toBe(true);
      expect(decision.reasons).toEqual([
        ENABLEMENT_REASONS.PERSISTENCE_ALLOWED,
        ENABLEMENT_REASONS.REVIEW_ENQUEUE_ALLOWED
      ]);
      expect(decision.metadata.persistenceEnabled).toBe(false);
      expect(decision.metadata.wouldEnablePersistence).toBe(true);
      expect(decision.metadata.wouldEnableReviewEnqueue).toBe(true);
    });

    test("only persistence flag true yields blocked overall for capability both", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({
          featureFlags: {
            automaticPersistenceEnabled: true,
            reviewQueueEnqueueEnabled: false
          }
        })
      );
      expect(decision.persistence.allowed).toBe(true);
      expect(decision.reviewEnqueue.allowed).toBe(false);
      expect(decision.allowed).toBe(false);
      expect(decision.blocked).toBe(true);
    });

    test("truthy non-boolean flags are treated as false (strict)", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({
          featureFlags: {
            automaticPersistenceEnabled: "true",
            reviewQueueEnqueueEnabled: 1,
            pipelineEnabled: "yes"
          }
        })
      );
      expect(decision.featureState.automaticPersistenceEnabled).toBe(false);
      expect(decision.featureState.reviewQueueEnqueueEnabled).toBe(false);
      expect(decision.featureState.pipelineEnabled).toBe(false);
      expect(decision.persistence.reasons).toContain(
        ENABLEMENT_REASONS.PIPELINE_DISABLED
      );
    });

    test("matrix of modes and flags remains consistent", () => {
      const modes = Object.values(EXECUTION_MODES);
      const flagPairs = [
        { automaticPersistenceEnabled: false, reviewQueueEnqueueEnabled: false },
        { automaticPersistenceEnabled: true, reviewQueueEnqueueEnabled: false },
        { automaticPersistenceEnabled: false, reviewQueueEnqueueEnabled: true },
        { automaticPersistenceEnabled: true, reviewQueueEnqueueEnabled: true }
      ];

      for (const executionMode of modes) {
        for (const flags of flagPairs) {
          const decision = evaluatePersistenceEnablement(
            baseConfig({ executionMode, featureFlags: flags })
          );
          if (executionMode !== EXECUTION_MODES.LIVE) {
            expect(decision.persistence.allowed).toBe(false);
            expect(decision.reviewEnqueue.allowed).toBe(false);
          } else {
            expect(decision.persistence.allowed).toBe(
              flags.automaticPersistenceEnabled
            );
            expect(decision.reviewEnqueue.allowed).toBe(
              flags.reviewQueueEnqueueEnabled
            );
          }
          expect(decision.executed).toBe(false);
          expect(decision.metadata.persistenceEnabled).toBe(false);
        }
      }
    });
  });

  describe("invalid configurations", () => {
    test("null and non-object configs are invalid and blocked", () => {
      for (const bad of [null, undefined, [], "live", 42, true]) {
        const decision = evaluatePersistenceEnablement(bad);
        expect(decision.allowed).toBe(false);
        expect(decision.blocked).toBe(true);
        expect(decision.reasons).toContain(
          ENABLEMENT_REASONS.INVALID_CONFIGURATION
        );
        expect(decision.metadata.configurationValid).toBe(false);
        expect(decision.architectureOnly).toBe(true);
        expect(isPersistenceEnablementArchitectureOnly(decision)).toBe(true);
      }
    });

    test("unsupported execution mode is rejected", () => {
      const validation = validateEnablementConfig(
        baseConfig({ executionMode: "staging" })
      );
      expect(validation.valid).toBe(false);
      expect(validation.reasons).toContain(
        ENABLEMENT_REASONS.INVALID_EXECUTION_MODE
      );

      const decision = evaluatePersistenceEnablement(
        baseConfig({ executionMode: "staging" })
      );
      expect(decision.blocked).toBe(true);
      expect(decision.reasons).toContain(
        ENABLEMENT_REASONS.INVALID_EXECUTION_MODE
      );
      expect(decision.metadata.configurationValid).toBe(false);
    });

    test("missing execution mode is rejected", () => {
      const decision = evaluatePersistenceEnablement({
        featureFlags: { automaticPersistenceEnabled: true }
      });
      expect(decision.blocked).toBe(true);
      expect(decision.reasons).toContain(
        ENABLEMENT_REASONS.INVALID_CONFIGURATION
      );
    });

    test("non-object featureFlags are rejected", () => {
      const decision = evaluatePersistenceEnablement({
        executionMode: EXECUTION_MODES.LIVE,
        featureFlags: ["bad"]
      });
      expect(decision.blocked).toBe(true);
      expect(decision.reasons).toContain(
        ENABLEMENT_REASONS.INVALID_FEATURE_FLAGS
      );
    });

    test("unsupported capability is rejected", () => {
      const decision = evaluatePersistenceEnablement(
        baseConfig({ capability: "migrate" })
      );
      expect(decision.blocked).toBe(true);
      expect(decision.reasons).toContain(ENABLEMENT_REASONS.INVALID_CAPABILITY);
    });

    test("validateEnablementConfig passes default config", () => {
      const result = validateEnablementConfig(createDefaultEnablementConfig());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.reasons).toEqual([ENABLEMENT_REASONS.VALID]);
    });
  });

  describe("deterministic behavior", () => {
    test("identical configs yield identical decisions", () => {
      const config = baseConfig({
        executionMode: EXECUTION_MODES.LIVE,
        featureFlags: {
          automaticPersistenceEnabled: true,
          reviewQueueEnqueueEnabled: false
        },
        capability: ENABLEMENT_CAPABILITIES.PERSISTENCE
      });
      expect(evaluatePersistenceEnablement(config)).toEqual(
        evaluatePersistenceEnablement(config)
      );
      expect(validateEnablementConfig(config)).toEqual(
        validateEnablementConfig(config)
      );
      expect(resolveFeatureState(config.featureFlags)).toEqual(
        resolveFeatureState(config.featureFlags)
      );
    });

    test("reasons are sorted uniquely", () => {
      const decision = evaluatePersistenceEnablement(
        createDefaultEnablementConfig()
      );
      const sorted = [...decision.reasons].sort((a, b) => a.localeCompare(b));
      expect(decision.reasons).toEqual(sorted);
      expect(new Set(decision.reasons).size).toBe(decision.reasons.length);
      expect(decision.reason).toBe(decision.reasons[0]);
    });
  });

  describe("non-mutation", () => {
    test("evaluate does not mutate input config", () => {
      const config = baseConfig({
        featureFlags: {
          automaticPersistenceEnabled: true,
          reviewQueueEnqueueEnabled: true
        },
        capability: ENABLEMENT_CAPABILITIES.BOTH
      });
      const before = JSON.stringify(config);
      evaluatePersistenceEnablement(config);
      validateEnablementConfig(config);
      resolveFeatureState(config.featureFlags);
      expect(JSON.stringify(config)).toBe(before);
    });

    test("returned decision clones do not share nested references with input", () => {
      const config = baseConfig({
        featureFlags: {
          automaticPersistenceEnabled: false,
          reviewQueueEnqueueEnabled: false
        }
      });
      const decision = evaluatePersistenceEnablement(config);
      decision.featureState.automaticPersistenceEnabled = true;
      decision.persistence.reasons.push("LEAK");
      decision.metadata.validationErrors.push("LEAK");
      expect(config.featureFlags.automaticPersistenceEnabled).toBe(false);

      const again = evaluatePersistenceEnablement(config);
      expect(again.featureState.automaticPersistenceEnabled).toBe(false);
      expect(again.persistence.reasons).not.toContain("LEAK");
      expect(again.metadata.validationErrors).not.toContain("LEAK");
    });

    test("mutating a prior decision does not affect a fresh evaluation", () => {
      const config = createDefaultEnablementConfig();
      const first = evaluatePersistenceEnablement(config);
      first.allowed = true;
      first.executed = true;
      first.metadata.persistenceEnabled = true;
      first.persistence.allowed = true;
      const second = evaluatePersistenceEnablement(config);
      expect(second.allowed).toBe(false);
      expect(second.executed).toBe(false);
      expect(second.metadata.persistenceEnabled).toBe(false);
      expect(second.persistence.allowed).toBe(false);
    });

    test("createDefaultEnablementConfig returns fresh objects", () => {
      const a = createDefaultEnablementConfig();
      const b = createDefaultEnablementConfig();
      a.featureFlags.automaticPersistenceEnabled = true;
      expect(b.featureFlags.automaticPersistenceEnabled).toBe(false);
      expect(DEFAULT_FEATURE_FLAGS.automaticPersistenceEnabled).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("enablement module has no DB / Express / queue / filesystem side effects", () => {
      const source = read("server/lib/recruitment/persistenceEnablement.js");
      expect(source).toMatch(/Phase 44/);
      expect(source).toMatch(/architecture only/i);
      expect(source).toMatch(/Never enables persistence/);
      expect(source).toMatch(/Never enables review queues/);
      expect(source).toMatch(/Never writes database data/);
      expect(source).toMatch(/Never calls repositories/);
      expect(source).toMatch(/Never modifies workers/);
      expect(source).toMatch(/Never changes runtime behavior/);
      expect(source).toMatch(/Never starts transactions/);
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
      expect(source).not.toMatch(/previewRuntimeWiring/);
      expect(source).not.toMatch(/siteWorker/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/require\(/);
    });

    test("siteWorker is unchanged — enablement not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/persistenceEnablement/);
      expect(worker).not.toMatch(/evaluatePersistenceEnablement/);
      expect(worker).not.toMatch(/createDefaultEnablementConfig/);
    });

    test("prior modules do not import the enablement framework", () => {
      const files = [
        "server/lib/recruitment/runtimePersistencePolicy.js",
        "server/lib/recruitment/runtimePersistenceService.js",
        "server/lib/recruitment/persistenceRepositoryContracts.js",
        "server/lib/recruitment/mysqlPersistenceRepositoryAdapters.js",
        "server/lib/recruitment/persistenceExecutionPipeline.js",
        "server/lib/recruitment/transactionCoordinator.js",
        "server/lib/recruitment/auditTrail.js",
        "server/lib/recruitment/executionContext.js",
        "server/lib/recruitment/previewRuntimeWiring.js",
        "server/lib/recruitment/dryRunPersistenceSimulator.js",
        "server/lib/recruitment/reviewWorkflow.js",
        "server/lib/recruitment/runtimePreviewBuffer.js",
        "server/lib/recruitment/reviewQueue.js",
        "server/config/recruitmentPipeline.js",
        "server/config/recruitmentLifecycle.js"
      ];
      for (const rel of files) {
        const source = read(rel);
        expect(source).not.toMatch(/persistenceEnablement/);
        expect(source).not.toMatch(/evaluatePersistenceEnablement/);
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
        "server/lib/recruitment/reviewWorkflow.js": /Phase 43/
      };
      for (const [rel, phase] of Object.entries(files)) {
        const source = read(rel);
        expect(source).toMatch(phase);
        expect(source).not.toMatch(/Phase 44/);
      }
    });

    test("decisions never enable automation, queues, persistence, or execution", () => {
      const source = read("server/lib/recruitment/persistenceEnablement.js");
      expect(source).toMatch(/executed: false/);
      expect(source).toMatch(/persistenceEnabled: false/);
      expect(source).toMatch(/queueEnqueueEnabled: false/);
      expect(source).toMatch(/automationEnabled: false/);
      expect(source).not.toMatch(/automaticPersistenceEnabled\s*=\s*true/);
      expect(source).not.toMatch(/reviewQueueEnqueueEnabled\s*=\s*true/);

      const samples = [
        evaluatePersistenceEnablement(createDefaultEnablementConfig()),
        evaluatePersistenceEnablement(
          baseConfig({
            executionMode: EXECUTION_MODES.PREVIEW,
            featureFlags: {
              automaticPersistenceEnabled: true,
              reviewQueueEnqueueEnabled: true
            }
          })
        ),
        evaluatePersistenceEnablement(
          baseConfig({
            executionMode: EXECUTION_MODES.DRY_RUN,
            featureFlags: {
              automaticPersistenceEnabled: true,
              reviewQueueEnqueueEnabled: true
            }
          })
        ),
        evaluatePersistenceEnablement(
          baseConfig({
            executionMode: EXECUTION_MODES.LIVE,
            featureFlags: {
              automaticPersistenceEnabled: true,
              reviewQueueEnqueueEnabled: true
            }
          })
        ),
        evaluatePersistenceEnablement(null)
      ];

      for (const decision of samples) {
        expect(decision.executed).toBe(false);
        expect(decision.architectureOnly).toBe(true);
        expect(decision.advisory).toBe(true);
        expect(decision.metadata.persistenceEnabled).toBe(false);
        expect(decision.metadata.automationEnabled).toBe(false);
        expect(decision.metadata.queueEnqueueEnabled).toBe(false);
        expect(decision.metadata.sideEffects).toBe(false);
        expect(isPersistenceEnablementArchitectureOnly(decision)).toBe(true);
      }
    });
  });
});
