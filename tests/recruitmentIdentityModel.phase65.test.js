"use strict";

/**
 * Phase 65 — Recruitment Identity Model tests.
 * Exports, immutability, identity uniqueness, helper behavior, descriptive
 * integrity, architecture boundaries, and zero runtime dependencies.
 */

const fs = require("fs");
const path = require("path");

const {
  IDENTITY_MODEL_PHASE,
  IDENTITY_CONFIDENCE_LEVELS,
  SUPPORTED_IDENTITY_CONFIDENCE_LEVELS,
  DEFAULT_IDENTITY_CONFIDENCE_LEVEL,
  IDENTITY_CONFIDENCE,
  IDENTITY_SOURCE_KINDS,
  SUPPORTED_IDENTITY_SOURCE_KINDS,
  DEFAULT_IDENTITY_SOURCE_KIND,
  IDENTITY_SOURCE,
  IDENTITY_SIGNAL_KEYS,
  SUPPORTED_IDENTITY_SIGNAL_KEYS,
  IDENTITY_SIGNALS,
  IDENTITY_SIGNAL_BY_KEY,
  IDENTITY_ANCHORS,
  IDENTITY_ANCHOR_BY_ID,
  IDENTITY_ANCHOR_BY_EVENT_TYPE,
  SUPPORTED_IDENTITY_ANCHOR_IDS,
  PRIMARY_IDENTITY_ANCHOR_IDS,
  ALTERNATE_IDENTITY_ANCHOR_IDS,
  IDENTITY_RESOLUTION_METADATA,
  RECRUITMENT_IDENTITY,
  IDENTITY_MODEL_METADATA,
  getIdentitySignals,
  getIdentitySignal,
  isIdentitySignal,
  listIdentityAnchors,
  getIdentityAnchor,
  isIdentityAnchor,
  isIdentityConfidenceLevel,
  isIdentitySourceKind,
  summarizeRecruitmentIdentityModel
} = require("../server/lib/recruitment/recruitmentIdentityModel");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentIdentityModel.js";

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

describe("Phase 65 — recruitmentIdentityModel", () => {
  describe("exports", () => {
    test("exposes phase 65 identity model constants and descriptors", () => {
      expect(IDENTITY_MODEL_PHASE).toBe(65);
      expect(RECRUITMENT_IDENTITY.entity).toBe("recruitment_identity");
      expect(IDENTITY_SOURCE.concept).toBe("identity_source");
      expect(IDENTITY_CONFIDENCE.concept).toBe("identity_confidence");
      expect(IDENTITY_RESOLUTION_METADATA.concept).toBe("identity_resolution_metadata");
      expect(IDENTITY_MODEL_METADATA.descriptiveOnly).toBe(true);
      expect(IDENTITY_MODEL_METADATA.runtimeIntegration).toBe(false);
      expect(IDENTITY_MODEL_METADATA.buildsOnDomainModelPhase).toBe(63);
      expect(IDENTITY_MODEL_METADATA.buildsOnLifecycleContractsPhase).toBe(64);
    });

    test("identity signal keys cover required common signals", () => {
      expect(IDENTITY_SIGNAL_KEYS).toEqual([
        "recruitment_title",
        "organization",
        "advertisement_number",
        "recruitment_year",
        "post_name",
        "department",
        "examination_name",
        "official_identifier",
        "source_url"
      ]);
      expect(SUPPORTED_IDENTITY_SIGNAL_KEYS.size).toBe(IDENTITY_SIGNAL_KEYS.length);
      expect(IDENTITY_SIGNALS.length).toBe(9);
    });

    test("identity anchors align with primary lifecycle contract vocabulary", () => {
      expect(PRIMARY_IDENTITY_ANCHOR_IDS).toEqual(["notification"]);
      expect(ALTERNATE_IDENTITY_ANCHOR_IDS).toEqual(["short_notification"]);
      expect(IDENTITY_ANCHORS.length).toBe(2);
      expect(SUPPORTED_IDENTITY_ANCHOR_IDS.size).toBe(2);
    });

    test("summarizeRecruitmentIdentityModel returns frozen advisory summary", () => {
      const summary = summarizeRecruitmentIdentityModel();
      expect(summary).toEqual({
        phase: 65,
        entity: "recruitment_identity",
        signalCount: IDENTITY_SIGNALS.length,
        anchorCount: IDENTITY_ANCHORS.length,
        primaryAnchorIds: PRIMARY_IDENTITY_ANCHOR_IDS,
        alternateAnchorIds: ALTERNATE_IDENTITY_ANCHOR_IDS,
        requiredSignalKeys: RECRUITMENT_IDENTITY.requiredSignalKeys,
        confidenceLevelCount: SUPPORTED_IDENTITY_CONFIDENCE_LEVELS.size,
        sourceKindCount: SUPPORTED_IDENTITY_SOURCE_KINDS.size,
        descriptiveOnly: true,
        architectureOnly: true,
        runtimeIntegration: false,
        persistenceEnabled: false,
        sideEffects: false,
        buildsOnDomainModelPhase: 63,
        buildsOnLifecycleContractsPhase: 64
      });
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("getIdentitySignals and listIdentityAnchors return canonical frozen catalogs", () => {
      expect(getIdentitySignals()).toBe(IDENTITY_SIGNALS);
      expect(listIdentityAnchors()).toBe(IDENTITY_ANCHORS);
    });
  });

  describe("identity uniqueness", () => {
    test("identity signal keys are unique", () => {
      const keys = IDENTITY_SIGNALS.map((signal) => signal.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    test("identity anchor ids are unique", () => {
      const ids = IDENTITY_ANCHORS.map((anchor) => anchor.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test("anchor event types appear at most once", () => {
      const eventTypes = IDENTITY_ANCHORS.map((anchor) => anchor.eventType);
      expect(new Set(eventTypes).size).toBe(eventTypes.length);
    });

    test("anchor orders are strictly increasing", () => {
      const orders = IDENTITY_ANCHORS.map((anchor) => anchor.order);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    test("lookup maps reference the same frozen objects", () => {
      for (const signal of IDENTITY_SIGNALS) {
        expect(IDENTITY_SIGNAL_BY_KEY[signal.key]).toBe(signal);
      }
      for (const anchor of IDENTITY_ANCHORS) {
        expect(IDENTITY_ANCHOR_BY_ID[anchor.id]).toBe(anchor);
        expect(IDENTITY_ANCHOR_BY_EVENT_TYPE[anchor.eventType]).toBe(anchor);
      }
    });

    test("every anchor id is registered in the supported set", () => {
      for (const anchor of IDENTITY_ANCHORS) {
        expect(SUPPORTED_IDENTITY_ANCHOR_IDS.has(anchor.id)).toBe(true);
      }
    });
  });

  describe("helper behavior", () => {
    test("getIdentitySignal returns frozen descriptor for known keys", () => {
      const signal = getIdentitySignal("advertisement_number");
      expect(signal).toEqual(
        expect.objectContaining({
          key: "advertisement_number",
          domainField: "advertisement_no",
          uniquenessWeight: "high"
        })
      );
      expect(Object.isFrozen(signal)).toBe(true);
    });

    test("getIdentitySignal returns null for empty or unknown keys", () => {
      expect(getIdentitySignal("")).toBeNull();
      expect(getIdentitySignal("   ")).toBeNull();
      expect(getIdentitySignal("not-a-signal")).toBeNull();
      expect(getIdentitySignal(null)).toBeNull();
    });

    test("isIdentitySignal accepts only declared signal keys", () => {
      for (const key of IDENTITY_SIGNAL_KEYS) {
        expect(isIdentitySignal(key)).toBe(true);
      }
      expect(isIdentitySignal("title")).toBe(false);
      expect(isIdentitySignal(null)).toBe(false);
    });

    test("getIdentityAnchor returns frozen anchor for known lifecycle ids", () => {
      const anchor = getIdentityAnchor("notification");
      expect(anchor).toEqual(
        expect.objectContaining({
          id: "notification",
          role: "primary_identity_anchor",
          establishesRecruitment: true,
          primary: true,
          alternate: false
        })
      );
      expect(Object.isFrozen(anchor)).toBe(true);
    });

    test("getIdentityAnchor returns null for empty or unknown ids", () => {
      expect(getIdentityAnchor("")).toBeNull();
      expect(getIdentityAnchor("admit_card")).toBeNull();
      expect(getIdentityAnchor(null)).toBeNull();
    });

    test("isIdentityAnchor identifies only declared anchor lifecycle events", () => {
      expect(isIdentityAnchor("notification")).toBe(true);
      expect(isIdentityAnchor("short_notification")).toBe(true);
      expect(isIdentityAnchor("correction")).toBe(false);
      expect(isIdentityAnchor("exam_date")).toBe(false);
      expect(isIdentityAnchor("bogus")).toBe(false);
    });

    test("isIdentityConfidenceLevel accepts only declared levels", () => {
      for (const level of Object.values(IDENTITY_CONFIDENCE_LEVELS)) {
        expect(isIdentityConfidenceLevel(level)).toBe(true);
      }
      expect(isIdentityConfidenceLevel("certain")).toBe(false);
      expect(isIdentityConfidenceLevel(null)).toBe(false);
    });

    test("isIdentitySourceKind accepts only declared source kinds", () => {
      for (const kind of Object.values(IDENTITY_SOURCE_KINDS)) {
        expect(isIdentitySourceKind(kind)).toBe(true);
      }
      expect(isIdentitySourceKind("scraped")).toBe(false);
      expect(isIdentitySourceKind(null)).toBe(false);
    });
  });

  describe("descriptive integrity", () => {
    test("recruitment identity wires source, confidence, and resolution concepts", () => {
      expect(RECRUITMENT_IDENTITY.sourceConcept).toBe(IDENTITY_SOURCE);
      expect(RECRUITMENT_IDENTITY.confidenceConcept).toBe(IDENTITY_CONFIDENCE);
      expect(RECRUITMENT_IDENTITY.resolutionMetadataConcept).toBe(
        IDENTITY_RESOLUTION_METADATA
      );
      expect(RECRUITMENT_IDENTITY.requiredSignalKeys).toEqual(["recruitment_title"]);
    });

    test("identity confidence remains descriptive and non-computational", () => {
      expect(IDENTITY_CONFIDENCE.description).toMatch(/advisory/i);
      expect(IDENTITY_CONFIDENCE.description).toMatch(/not a computed score/i);
      expect(DEFAULT_IDENTITY_CONFIDENCE_LEVEL).toBe("unknown");
      expect(IDENTITY_CONFIDENCE.advisoryLabels.high).toBeTruthy();
      expect(IDENTITY_CONFIDENCE.advisoryLabels.unknown).toBeTruthy();
    });

    test("identity source maps anchor events to source kinds", () => {
      expect(IDENTITY_SOURCE.anchorSourceKindMap.notification).toBe(
        IDENTITY_SOURCE_KINDS.OFFICIAL_NOTIFICATION
      );
      expect(IDENTITY_SOURCE.anchorSourceKindMap.short_notification).toBe(
        IDENTITY_SOURCE_KINDS.SHORT_NOTIFICATION
      );
      expect(DEFAULT_IDENTITY_SOURCE_KIND).toBe("unknown");
    });

    test("identity resolution metadata declares required anchorEventId field", () => {
      expect(IDENTITY_RESOLUTION_METADATA.requiredFields).toEqual(["anchorEventId"]);
      expect(IDENTITY_RESOLUTION_METADATA.fields.confidenceLevel.allowedValues).toBe(
        SUPPORTED_IDENTITY_CONFIDENCE_LEVELS
      );
      expect(IDENTITY_RESOLUTION_METADATA.fields.sourceKind.allowedValues).toBe(
        SUPPORTED_IDENTITY_SOURCE_KINDS
      );
    });

    test("anchor typical signals reference only known identity signals", () => {
      for (const anchor of IDENTITY_ANCHORS) {
        for (const signalKey of anchor.typicalSignals) {
          expect(isIdentitySignal(signalKey)).toBe(true);
        }
        expect(anchor.advisoryNotes.length).toBeGreaterThan(0);
      }
    });

    test("domain field mappings align with phase 63 recruitment field vocabulary", () => {
      expect(getIdentitySignal("recruitment_title").domainField).toBe("title");
      expect(getIdentitySignal("advertisement_number").domainField).toBe(
        "advertisement_no"
      );
      expect(getIdentitySignal("recruitment_year").domainField).toBe("cycle_year");
      expect(getIdentitySignal("post_name").domainField).toBe("post_name");
      expect(getIdentitySignal("department").domainField).toBe("department");
      expect(getIdentitySignal("organization").domainField).toBeNull();
      expect(getIdentitySignal("source_url").domainField).toBeNull();
    });

    test("non-anchor lifecycle events are excluded from identity anchors", () => {
      const nonAnchors = [
        "correction",
        "exam_date",
        "admit_card",
        "result",
        "final_result",
        "joining"
      ];
      for (const id of nonAnchors) {
        expect(isIdentityAnchor(id)).toBe(false);
        expect(getIdentityAnchor(id)).toBeNull();
      }
    });

    test("helpers only read metadata without side effects", () => {
      const before = summarizeRecruitmentIdentityModel();
      getIdentitySignal("recruitment_title");
      getIdentityAnchor("notification");
      isIdentityAnchor("short_notification");
      isIdentitySignal("department");
      isIdentityConfidenceLevel("high");
      isIdentitySourceKind("manual_entry");
      const after = summarizeRecruitmentIdentityModel();
      expect(after).toEqual(before);
      expect(IDENTITY_MODEL_METADATA.sideEffects).toBe(false);
    });
  });

  describe("immutability", () => {
    test("top-level exported constants are frozen", () => {
      expect(Object.isFrozen(IDENTITY_SIGNALS)).toBe(true);
      expect(Object.isFrozen(IDENTITY_SIGNAL_BY_KEY)).toBe(true);
      expect(Object.isFrozen(IDENTITY_ANCHORS)).toBe(true);
      expect(Object.isFrozen(IDENTITY_ANCHOR_BY_ID)).toBe(true);
      expect(Object.isFrozen(RECRUITMENT_IDENTITY)).toBe(true);
      expect(Object.isFrozen(IDENTITY_MODEL_METADATA)).toBe(true);
      expect(Object.isFrozen(PRIMARY_IDENTITY_ANCHOR_IDS)).toBe(true);
      expect(Object.isFrozen(ALTERNATE_IDENTITY_ANCHOR_IDS)).toBe(true);
    });

    test("nested identity graph is deeply frozen", () => {
      assertAllFrozen(IDENTITY_SIGNALS);
      assertAllFrozen(IDENTITY_ANCHORS);
      assertAllFrozen(RECRUITMENT_IDENTITY);
      assertAllFrozen(IDENTITY_RESOLUTION_METADATA);
      assertAllFrozen(IDENTITY_CONFIDENCE);
      assertAllFrozen(IDENTITY_SOURCE);
    });

    test("mutation attempts on signal catalog do not change exports", () => {
      const before = IDENTITY_SIGNALS.length;
      expect(() => {
        IDENTITY_SIGNALS.push({});
      }).toThrow();
      expect(IDENTITY_SIGNALS.length).toBe(before);
    });

    test("mutation attempts on anchor typical signals are rejected", () => {
      const notification = getIdentityAnchor("notification");
      expect(() => {
        notification.typicalSignals.push("bogus");
      }).toThrow();
      expect(notification.typicalSignals).not.toContain("bogus");
    });
  });

  describe("circular references", () => {
    test("exported identity graph has no circular references", () => {
      expect(hasCircularReference(IDENTITY_SIGNALS)).toBe(false);
      expect(hasCircularReference(IDENTITY_ANCHORS)).toBe(false);
      expect(hasCircularReference(RECRUITMENT_IDENTITY)).toBe(false);
      expect(hasCircularReference(IDENTITY_RESOLUTION_METADATA)).toBe(false);
      expect(hasCircularReference(IDENTITY_MODEL_METADATA)).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("identity model module has no DB / Express / filesystem / env access", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/Phase 65/);
      expect(source).toMatch(/Pure descriptive library/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
    });

    test("identity model module has zero require dependencies", () => {
      const source = read(MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
    });

    test("production modules are unchanged — identity model not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/recruitmentIdentityModel/);

      const domainModel = read("server/lib/recruitment/recruitmentDomainModel.js");
      expect(domainModel).not.toMatch(/recruitmentIdentityModel/);

      const lifecycleContracts = read(
        "server/lib/recruitment/recruitmentLifecycleContracts.js"
      );
      expect(lifecycleContracts).not.toMatch(/recruitmentIdentityModel/);

      const preview = read("server/lib/recruitment/runtimePreviewBuffer.js");
      const policy = read("server/lib/recruitment/runtimePersistencePolicy.js");
      expect(preview).not.toMatch(/recruitmentIdentityModel/);
      expect(policy).not.toMatch(/recruitmentIdentityModel/);
    });

    test("runtime, capability, and diagnostics modules do not import identity model", () => {
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
        expect(read(relPath)).not.toMatch(/recruitmentIdentityModel/);
      }
    });
  });
});
