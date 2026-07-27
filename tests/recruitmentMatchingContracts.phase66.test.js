"use strict";

/**
 * Phase 66 — Recruitment Matching Contracts tests.
 * Exports, immutability, helper behavior, profile uniqueness, review scenarios,
 * descriptive integrity, architecture boundaries, and zero runtime dependencies.
 */

const fs = require("fs");
const path = require("path");

const {
  MATCHING_CONTRACTS_PHASE,
  MATCH_CATEGORIES,
  SUPPORTED_MATCH_CATEGORIES,
  DEFAULT_MATCH_CATEGORY,
  MATCH_CATEGORY_DESCRIPTOR,
  MATCH_SIGNAL_WEIGHTS,
  SUPPORTED_MATCH_SIGNAL_WEIGHTS,
  MATCH_SIGNAL_KEYS,
  SUPPORTED_MATCH_SIGNAL_KEYS,
  MATCH_SIGNALS,
  MATCH_SIGNAL_BY_KEY,
  MATCHING_PROFILES,
  MATCHING_PROFILE_BY_ID,
  SUPPORTED_MATCHING_PROFILE_IDS,
  MANUAL_REVIEW_SCENARIO_IDS,
  SUPPORTED_MANUAL_REVIEW_SCENARIO_IDS,
  MANUAL_REVIEW_SCENARIOS,
  MANUAL_REVIEW_SCENARIO_BY_ID,
  MATCHING_METADATA,
  RECRUITMENT_MATCHING,
  MATCHING_CONTRACTS_METADATA,
  getMatchingSignals,
  getMatchingSignal,
  isMatchingSignal,
  getMatchingProfiles,
  getMatchingProfile,
  isMatchingProfile,
  getReviewScenarios,
  getReviewScenario,
  isManualReviewScenario,
  isMatchCategory,
  summarizeRecruitmentMatchingContracts
} = require("../server/lib/recruitment/recruitmentMatchingContracts");

const ROOT = path.join(__dirname, "..");
const MODULE_PATH = "server/lib/recruitment/recruitmentMatchingContracts.js";

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

describe("Phase 66 — recruitmentMatchingContracts", () => {
  describe("exports", () => {
    test("exposes phase 66 matching contract constants and descriptors", () => {
      expect(MATCHING_CONTRACTS_PHASE).toBe(66);
      expect(RECRUITMENT_MATCHING.entity).toBe("recruitment_matching");
      expect(MATCH_CATEGORY_DESCRIPTOR.concept).toBe("match_category");
      expect(MATCHING_METADATA.concept).toBe("matching_metadata");
      expect(MATCHING_CONTRACTS_METADATA.descriptiveOnly).toBe(true);
      expect(MATCHING_CONTRACTS_METADATA.runtimeIntegration).toBe(false);
      expect(MATCHING_CONTRACTS_METADATA.scoreCalculation).toBe(false);
      expect(MATCHING_CONTRACTS_METADATA.matchingExecution).toBe(false);
      expect(MATCHING_CONTRACTS_METADATA.buildsOnIdentityModelPhase).toBe(65);
    });

    test("match categories cover all six advisory labels", () => {
      expect(Object.values(MATCH_CATEGORIES)).toEqual([
        "exact_match",
        "strong_match",
        "probable_match",
        "weak_match",
        "no_match",
        "manual_review"
      ]);
      expect(SUPPORTED_MATCH_CATEGORIES.size).toBe(6);
      expect(DEFAULT_MATCH_CATEGORY).toBe("no_match");
    });

    test("match signal keys align with phase 65 identity signal vocabulary", () => {
      expect(MATCH_SIGNAL_KEYS).toEqual([
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
      expect(SUPPORTED_MATCH_SIGNAL_KEYS.size).toBe(MATCH_SIGNAL_KEYS.length);
      expect(MATCH_SIGNALS.length).toBe(9);
    });

    test("manual review scenario ids cover required advisory scenarios", () => {
      expect(MANUAL_REVIEW_SCENARIO_IDS).toEqual([
        "conflicting_advertisement_numbers",
        "insufficient_identity_signals",
        "conflicting_organizations",
        "conflicting_recruitment_years"
      ]);
      expect(MANUAL_REVIEW_SCENARIOS.length).toBe(4);
      expect(SUPPORTED_MANUAL_REVIEW_SCENARIO_IDS.size).toBe(4);
    });

    test("summarizeRecruitmentMatchingContracts returns frozen advisory summary", () => {
      const summary = summarizeRecruitmentMatchingContracts();
      expect(summary).toEqual({
        phase: 66,
        entity: "recruitment_matching",
        matchSignalCount: MATCH_SIGNALS.length,
        matchingProfileCount: MATCHING_PROFILES.length,
        manualReviewScenarioCount: MANUAL_REVIEW_SCENARIOS.length,
        matchCategoryCount: SUPPORTED_MATCH_CATEGORIES.size,
        primarySignalKeys: RECRUITMENT_MATCHING.primarySignalKeys,
        conflictReviewSignalKeys: RECRUITMENT_MATCHING.conflictReviewSignalKeys,
        descriptiveOnly: true,
        architectureOnly: true,
        runtimeIntegration: false,
        persistenceEnabled: false,
        sideEffects: false,
        scoreCalculation: false,
        matchingExecution: false,
        buildsOnDomainModelPhase: 63,
        buildsOnLifecycleContractsPhase: 64,
        buildsOnIdentityModelPhase: 65
      });
      expect(Object.isFrozen(summary)).toBe(true);
    });

    test("getMatchingSignals and getMatchingProfiles return canonical frozen catalogs", () => {
      expect(getMatchingSignals()).toBe(MATCH_SIGNALS);
      expect(getMatchingProfiles()).toBe(MATCHING_PROFILES);
      expect(getReviewScenarios()).toBe(MANUAL_REVIEW_SCENARIOS);
    });
  });

  describe("profile uniqueness", () => {
    test("matching profile ids are unique", () => {
      const ids = MATCHING_PROFILES.map((profile) => profile.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test("matching profile orders are strictly increasing", () => {
      const orders = MATCHING_PROFILES.map((profile) => profile.order);
      for (let i = 1; i < orders.length; i += 1) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    test("every profile category is a supported match category", () => {
      for (const profile of MATCHING_PROFILES) {
        expect(isMatchCategory(profile.category)).toBe(true);
      }
    });

    test("lookup maps reference the same frozen profile objects", () => {
      for (const profile of MATCHING_PROFILES) {
        expect(MATCHING_PROFILE_BY_ID[profile.id]).toBe(profile);
      }
    });

    test("every profile id is registered in the supported set", () => {
      for (const profile of MATCHING_PROFILES) {
        expect(SUPPORTED_MATCHING_PROFILE_IDS.has(profile.id)).toBe(true);
      }
    });

    test("profile required signals reference only known match signals", () => {
      for (const profile of MATCHING_PROFILES) {
        for (const signalKey of profile.requiredSignals) {
          expect(isMatchingSignal(signalKey)).toBe(true);
        }
        for (const signalKey of profile.optionalSignals) {
          expect(isMatchingSignal(signalKey)).toBe(true);
        }
      }
    });
  });

  describe("review scenarios", () => {
    test("manual review scenario ids are unique", () => {
      const ids = MANUAL_REVIEW_SCENARIOS.map((scenario) => scenario.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test("all review scenarios map to manual_review category", () => {
      for (const scenario of MANUAL_REVIEW_SCENARIOS) {
        expect(scenario.category).toBe(MATCH_CATEGORIES.MANUAL_REVIEW);
      }
    });

    test("lookup maps reference the same frozen scenario objects", () => {
      for (const scenario of MANUAL_REVIEW_SCENARIOS) {
        expect(MANUAL_REVIEW_SCENARIO_BY_ID[scenario.id]).toBe(scenario);
      }
    });

    test("conflicting advertisement numbers scenario references advertisement signal", () => {
      const scenario = getReviewScenario("conflicting_advertisement_numbers");
      expect(scenario.triggerSignals).toEqual(["advertisement_number"]);
      expect(scenario.relatedProfileId).toBe("manual_review_ambiguous");
    });

    test("conflicting organizations scenario references organization signal", () => {
      const scenario = getReviewScenario("conflicting_organizations");
      expect(scenario.triggerSignals).toEqual(["organization"]);
    });

    test("conflicting recruitment years scenario references year signal", () => {
      const scenario = getReviewScenario("conflicting_recruitment_years");
      expect(scenario.triggerSignals).toEqual(["recruitment_year"]);
    });

    test("insufficient identity signals scenario has no trigger signals", () => {
      const scenario = getReviewScenario("insufficient_identity_signals");
      expect(scenario.triggerSignals).toEqual([]);
      expect(scenario.advisoryNotes.length).toBeGreaterThan(0);
    });

    test("isManualReviewScenario accepts only declared scenario ids", () => {
      for (const id of MANUAL_REVIEW_SCENARIO_IDS) {
        expect(isManualReviewScenario(id)).toBe(true);
      }
      expect(isManualReviewScenario("conflicting_titles")).toBe(false);
      expect(isManualReviewScenario(null)).toBe(false);
      expect(isManualReviewScenario("")).toBe(false);
    });
  });

  describe("helper behavior", () => {
    test("getMatchingSignal returns frozen descriptor for known keys", () => {
      const signal = getMatchingSignal("advertisement_number");
      expect(signal).toEqual(
        expect.objectContaining({
          key: "advertisement_number",
          matchingRole: "primary",
          discriminativeWeight: "high",
          conflictTriggersReview: true
        })
      );
      expect(Object.isFrozen(signal)).toBe(true);
    });

    test("getMatchingSignal returns null for empty or unknown keys", () => {
      expect(getMatchingSignal("")).toBeNull();
      expect(getMatchingSignal("   ")).toBeNull();
      expect(getMatchingSignal("not-a-signal")).toBeNull();
      expect(getMatchingSignal(null)).toBeNull();
    });

    test("isMatchingSignal accepts only declared signal keys", () => {
      for (const key of MATCH_SIGNAL_KEYS) {
        expect(isMatchingSignal(key)).toBe(true);
      }
      expect(isMatchingSignal("title")).toBe(false);
      expect(isMatchingSignal(null)).toBe(false);
    });

    test("getMatchingProfile returns frozen profile for known ids", () => {
      const profile = getMatchingProfile("official_identifier_exact");
      expect(profile).toEqual(
        expect.objectContaining({
          id: "official_identifier_exact",
          category: MATCH_CATEGORIES.EXACT_MATCH,
          requiredSignals: ["advertisement_number", "official_identifier"]
        })
      );
      expect(Object.isFrozen(profile)).toBe(true);
    });

    test("getMatchingProfile returns null for empty or unknown ids", () => {
      expect(getMatchingProfile("")).toBeNull();
      expect(getMatchingProfile("bogus_profile")).toBeNull();
      expect(getMatchingProfile(null)).toBeNull();
    });

    test("isMatchingProfile identifies only declared profile ids", () => {
      expect(isMatchingProfile("official_identifier_exact")).toBe(true);
      expect(isMatchingProfile("manual_review_ambiguous")).toBe(true);
      expect(isMatchingProfile("unknown")).toBe(false);
    });

    test("getReviewScenario returns frozen scenario for known ids", () => {
      const scenario = getReviewScenario("conflicting_organizations");
      expect(scenario).toEqual(
        expect.objectContaining({
          id: "conflicting_organizations",
          label: "Conflicting Organizations"
        })
      );
      expect(Object.isFrozen(scenario)).toBe(true);
    });

    test("getReviewScenario returns null for empty or unknown ids", () => {
      expect(getReviewScenario("")).toBeNull();
      expect(getReviewScenario("not-a-scenario")).toBeNull();
      expect(getReviewScenario(null)).toBeNull();
    });

    test("isMatchCategory accepts only declared categories", () => {
      for (const category of Object.values(MATCH_CATEGORIES)) {
        expect(isMatchCategory(category)).toBe(true);
      }
      expect(isMatchCategory("perfect_match")).toBe(false);
      expect(isMatchCategory(null)).toBe(false);
    });
  });

  describe("descriptive integrity", () => {
    test("recruitment matching wires category and metadata concepts", () => {
      expect(RECRUITMENT_MATCHING.categoryConcept).toBe(MATCH_CATEGORY_DESCRIPTOR);
      expect(RECRUITMENT_MATCHING.metadataConcept).toBe(MATCHING_METADATA);
      expect(RECRUITMENT_MATCHING.matchSignals).toBe(MATCH_SIGNALS);
      expect(RECRUITMENT_MATCHING.matchingProfiles).toBe(MATCHING_PROFILES);
      expect(RECRUITMENT_MATCHING.manualReviewScenarios).toBe(
        MANUAL_REVIEW_SCENARIOS
      );
    });

    test("match category descriptor remains descriptive and non-computational", () => {
      expect(MATCH_CATEGORY_DESCRIPTOR.description).toMatch(/advisory/i);
      expect(MATCH_CATEGORY_DESCRIPTOR.description).toMatch(/not a computed score/i);
      expect(MATCH_CATEGORY_DESCRIPTOR.advisoryLabels.exact_match).toBeTruthy();
      expect(MATCH_CATEGORY_DESCRIPTOR.advisoryLabels.manual_review).toBeTruthy();
    });

    test("matching metadata declares required category field", () => {
      expect(MATCHING_METADATA.requiredFields).toEqual(["category"]);
      expect(MATCHING_METADATA.fields.category.allowedValues).toBe(
        SUPPORTED_MATCH_CATEGORIES
      );
      expect(MATCHING_METADATA.fields.profileId.allowedValues).toBe(
        SUPPORTED_MATCHING_PROFILE_IDS
      );
      expect(MATCHING_METADATA.fields.reviewScenarioId.allowedValues).toBe(
        SUPPORTED_MANUAL_REVIEW_SCENARIO_IDS
      );
    });

    test("match signals map to identity signal keys without import coupling", () => {
      for (const signal of MATCH_SIGNALS) {
        expect(signal.identitySignalKey).toBe(signal.key);
        expect(MATCH_SIGNAL_BY_KEY[signal.key]).toBe(signal);
      }
    });

    test("primary and conflict review signal keys are derived from signal catalog", () => {
      expect(RECRUITMENT_MATCHING.primarySignalKeys).toEqual([
        "advertisement_number",
        "official_identifier",
        "organization"
      ]);
      expect(RECRUITMENT_MATCHING.conflictReviewSignalKeys).toEqual([
        "advertisement_number",
        "organization",
        "recruitment_year"
      ]);
    });

    test("profiles span all non-review categories plus manual review", () => {
      const profileCategories = new Set(
        MATCHING_PROFILES.map((profile) => profile.category)
      );
      expect(profileCategories.has(MATCH_CATEGORIES.EXACT_MATCH)).toBe(true);
      expect(profileCategories.has(MATCH_CATEGORIES.STRONG_MATCH)).toBe(true);
      expect(profileCategories.has(MATCH_CATEGORIES.PROBABLE_MATCH)).toBe(true);
      expect(profileCategories.has(MATCH_CATEGORIES.WEAK_MATCH)).toBe(true);
      expect(profileCategories.has(MATCH_CATEGORIES.NO_MATCH)).toBe(true);
      expect(profileCategories.has(MATCH_CATEGORIES.MANUAL_REVIEW)).toBe(true);
    });

    test("helpers only read metadata without side effects", () => {
      const before = summarizeRecruitmentMatchingContracts();
      getMatchingSignal("organization");
      getMatchingProfile("title_organization_year_probable");
      getReviewScenario("insufficient_identity_signals");
      isManualReviewScenario("conflicting_advertisement_numbers");
      isMatchCategory("strong_match");
      const after = summarizeRecruitmentMatchingContracts();
      expect(after).toEqual(before);
      expect(MATCHING_CONTRACTS_METADATA.sideEffects).toBe(false);
    });
  });

  describe("immutability", () => {
    test("top-level exported constants are frozen", () => {
      expect(Object.isFrozen(MATCH_SIGNALS)).toBe(true);
      expect(Object.isFrozen(MATCH_SIGNAL_BY_KEY)).toBe(true);
      expect(Object.isFrozen(MATCHING_PROFILES)).toBe(true);
      expect(Object.isFrozen(MATCHING_PROFILE_BY_ID)).toBe(true);
      expect(Object.isFrozen(MANUAL_REVIEW_SCENARIOS)).toBe(true);
      expect(Object.isFrozen(RECRUITMENT_MATCHING)).toBe(true);
      expect(Object.isFrozen(MATCHING_CONTRACTS_METADATA)).toBe(true);
    });

    test("nested matching graph is deeply frozen", () => {
      assertAllFrozen(MATCH_SIGNALS);
      assertAllFrozen(MATCHING_PROFILES);
      assertAllFrozen(MANUAL_REVIEW_SCENARIOS);
      assertAllFrozen(RECRUITMENT_MATCHING);
      assertAllFrozen(MATCHING_METADATA);
      assertAllFrozen(MATCH_CATEGORY_DESCRIPTOR);
    });

    test("mutation attempts on signal catalog do not change exports", () => {
      const before = MATCH_SIGNALS.length;
      expect(() => {
        MATCH_SIGNALS.push({});
      }).toThrow();
      expect(MATCH_SIGNALS.length).toBe(before);
    });

    test("mutation attempts on profile required signals are rejected", () => {
      const profile = getMatchingProfile("official_identifier_exact");
      expect(() => {
        profile.requiredSignals.push("bogus");
      }).toThrow();
      expect(profile.requiredSignals).not.toContain("bogus");
    });
  });

  describe("circular references", () => {
    test("exported matching graph has no circular references", () => {
      expect(hasCircularReference(MATCH_SIGNALS)).toBe(false);
      expect(hasCircularReference(MATCHING_PROFILES)).toBe(false);
      expect(hasCircularReference(MANUAL_REVIEW_SCENARIOS)).toBe(false);
      expect(hasCircularReference(RECRUITMENT_MATCHING)).toBe(false);
      expect(hasCircularReference(MATCHING_METADATA)).toBe(false);
      expect(hasCircularReference(MATCHING_CONTRACTS_METADATA)).toBe(false);
    });
  });

  describe("architecture boundaries (source)", () => {
    test("matching contracts module has no DB / Express / filesystem / env access", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/Phase 66/);
      expect(source).toMatch(/Pure descriptive library/);
      expect(source).not.toMatch(/require\(["']express["']\)/);
      expect(source).not.toMatch(/require\(["']fs["']\)/);
      expect(source).not.toMatch(/require\(["']mysql2?["']\)/);
      expect(source).not.toMatch(/require\(["'].*config\/db["']\)/);
      expect(source).not.toMatch(/process\.env/);
      expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
    });

    test("matching contracts module has zero require dependencies", () => {
      const source = read(MODULE_PATH);
      const requires = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        (m) => m[1]
      );
      expect(requires).toEqual([]);
    });

    test("module does not import or execute matching logic", () => {
      const source = read(MODULE_PATH);
      expect(source).toMatch(/No score calculation/i);
      expect(source).not.toMatch(/recruitmentMatcher/);
      expect(source).not.toMatch(/function\s+match/i);
      expect(source).not.toMatch(/calculateScore/);
      expect(source).not.toMatch(/score\s*[=+]/);
    });

    test("production modules are unchanged — matching contracts not wired", () => {
      const worker = read("server/services/workers/siteWorker.js");
      expect(worker).not.toMatch(/recruitmentMatchingContracts/);

      const domainModel = read("server/lib/recruitment/recruitmentDomainModel.js");
      expect(domainModel).not.toMatch(/recruitmentMatchingContracts/);

      const lifecycleContracts = read(
        "server/lib/recruitment/recruitmentLifecycleContracts.js"
      );
      expect(lifecycleContracts).not.toMatch(/recruitmentMatchingContracts/);

      const identityModel = read("server/lib/recruitment/recruitmentIdentityModel.js");
      expect(identityModel).not.toMatch(/recruitmentMatchingContracts/);

      const matcher = read("server/lib/recruitment/recruitmentMatcher.js");
      expect(matcher).not.toMatch(/recruitmentMatchingContracts/);

      const preview = read("server/lib/recruitment/runtimePreviewBuffer.js");
      const policy = read("server/lib/recruitment/runtimePersistencePolicy.js");
      expect(preview).not.toMatch(/recruitmentMatchingContracts/);
      expect(policy).not.toMatch(/recruitmentMatchingContracts/);
    });

    test("runtime, capability, and diagnostics modules do not import matching contracts", () => {
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
        expect(read(relPath)).not.toMatch(/recruitmentMatchingContracts/);
      }
    });
  });
});
