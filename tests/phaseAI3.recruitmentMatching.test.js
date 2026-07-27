"use strict";

/**
 * Phase AI-3 — Recruitment Matching & Recommendation Engine tests.
 *
 * Covers candidate search, weighted similarity, the twelve update
 * relationships, all six recommendations, the three confidence dimensions and
 * the five required validation flags, across new recruitments, updates,
 * duplicates, admit cards, results, corrections, extensions, same-title/
 * different-year, same-board/different-recruitment, Hindi and mixed-language
 * notices — plus proof that the Production Workflow is untouched.
 */

const { NOTICES: AI2_NOTICES } = require("./fixtures/ai2/governmentNotices");
const {
  RECRUITMENTS,
  DUPLICATED_RECRUITMENTS,
  NOTICES: AI3_NOTICES
} = require("./fixtures/ai3/recruitmentRepository");

const {
  analyzeGovernmentNotice,
  enrichMonitoringEvent,
  LANGUAGES
} = require("../server/lib/noticeIntelligence");
const {
  matchRecruitment,
  enrichEventWithRecommendation,
  readRecommendation,
  attachRecommendation,
  buildEventIdentity,
  buildRecruitmentIndex,
  normalizeRecruitmentRecord,
  searchCandidates,
  scoreSimilarity,
  rankCandidates,
  classifyUpdateRelationship,
  assessLifecyclePlausibility,
  mapUpdateToCandidate,
  findRecordedDuplicate,
  validateMatching,
  evaluateRecommendation,
  scoreCandidateSelection,
  scoreMatchQuality,
  titleSimilarity,
  compareIdentifiers,
  compareOrganizations,
  foldIdentifier,
  assessTitleAmbiguity,
  RULES,
  RECOMMENDATION_FIELD,
  RECOMMENDATIONS,
  UPDATE_RELATIONSHIPS,
  SIMILARITY_FACTORS,
  FACTOR_WEIGHTS,
  FACTOR_STATUS,
  MATCH_QUALITY,
  MATCH_THRESHOLDS,
  SEARCH_STRATEGIES,
  VALIDATION_CODES,
  RULE_IDS,
  VALIDATION_SEVERITY,
  IDENTIFIER_CONFLICT_CEILING,
  FORMAT_ID,
  ENGINE_VERSION,
  PHASE
} = require("../server/lib/recruitmentMatching");

const {
  runProductionWorkflow,
  WORKFLOW_STATES,
  STAGE_STATUS,
  PUBLISHING_POLICY
} = require("../server/lib/productionWorkflow");
const telegramNotification = require("../server/lib/monitoringBot/telegramNotification");
const { getAutomationFlags } = require("../server/config/automationFlags");

const NOW = new Date("2026-07-26T00:00:00Z");
const ALL_NOTICES = { ...AI2_NOTICES, ...AI3_NOTICES };
const CROWDED_REPOSITORY = [...RECRUITMENTS, ...DUPLICATED_RECRUITMENTS];

/**
 * Run Phase AI-2 then Phase AI-3 over a fixture, which is how the phases
 * compose in the target flow.
 *
 * @param {string} fixtureName
 * @param {Array<object>} [repository]
 * @returns {object} the AI-3 result, with the normalized event attached
 */
function match(fixtureName, repository = RECRUITMENTS) {
  const { normalizedEvent } = analyzeGovernmentNotice(ALL_NOTICES[fixtureName], { now: NOW });
  const result = matchRecruitment(normalizedEvent, repository, { now: NOW });
  return { ...result, normalizedEvent };
}

/**
 * @param {string} fixtureName
 * @param {Array<object>} [repository]
 * @returns {object} the recommendation object only
 */
function recommend(fixtureName, repository = RECRUITMENTS) {
  return match(fixtureName, repository).recommendation;
}

/**
 * @param {object} recommendation
 * @param {string} factor
 * @returns {object}
 */
function factorOf(recommendation, factor) {
  return recommendation.bestMatch.similarity.factors.find((entry) => entry.factor === factor);
}

describe("Phase AI-3 recruitment record normalization", () => {
  test("reads records through field aliases", () => {
    const record = normalizeRecruitmentRecord({
      recruitmentId: "REC-X",
      recruitmentName: "UPSSSC Junior Assistant Recruitment 2026",
      organization: "Uttar Pradesh Subordinate Services Selection Commission",
      advtNo: "07-Exam/2026",
      year: "2026"
    });
    expect(record.title).toBe("UPSSSC Junior Assistant Recruitment 2026");
    expect(record.board).toBe("Uttar Pradesh Subordinate Services Selection Commission");
    expect(record.advertisementNumber).toBe("07-Exam/2026");
    expect(record.year).toBe(2026);
    expect(record.identifierKeys).toContain(foldIdentifier("07-Exam/2026"));
  });

  test("infers category and derives the year from the title when absent", () => {
    const record = normalizeRecruitmentRecord({
      recruitmentId: "REC-Y",
      recruitmentName: "RRB Group D Recruitment 2025",
      organization: "Railway Recruitment Board"
    });
    expect(record.category).toBe("railway");
    expect(record.year).toBe(2025);
  });

  test("indexes records by identifier, board, token and keyword", () => {
    const index = buildRecruitmentIndex(RECRUITMENTS);
    expect(index.isIndex).toBe(true);
    expect(index.size).toBe(RECRUITMENTS.length);
    expect(index.byIdentifier.has(foldIdentifier("A-1/E-1/2026"))).toBe(true);
    expect(index.byBoard.has("uppsc")).toBe(true);
    expect(index.byId.get("REC-SSC-GD-2026").referenceNumber).toBe("15/2026-CGD");
  });

  test("builds an event identity from a Phase AI-2 normalized event", () => {
    const { normalizedEvent } = analyzeGovernmentNotice(AI2_NOTICES.UPPSC_NEW_RECRUITMENT, { now: NOW });
    const identity = buildEventIdentity(normalizedEvent);
    expect(identity.advertisementNumber).toBe("A-1/E-1/2026");
    expect(identity.boardCode).toBe("UPPSC");
    expect(identity.year).toBe(2026);
    expect(identity.keywords.length).toBeGreaterThan(0);
    expect(identity.eventType).toBe(normalizedEvent.eventType);
  });
});

describe("Phase AI-3 candidate search", () => {
  test("blocks on the advertisement number when the event carries one", () => {
    const result = match("UPPSC_UPPER_ADMIT_CARD");
    expect(result.search.identifierBlocked).toBe(true);
    expect(result.search.strategiesUsed).toContain(SEARCH_STRATEGIES.ADVERTISEMENT_NUMBER);
    expect(result.recommendation.bestMatch.recruitmentId).toBe("REC-UPPSC-UPPER-2026");
  });

  test("finds the recruitment through an alternate official identifier", () => {
    const recommendation = recommend("RAILWAY_TECHNICIAN_RESULT");
    expect(recommendation.bestMatch.recruitmentId).toBe("REC-RRB-TECH-2025");
    expect(factorOf(recommendation, SIMILARITY_FACTORS.ADVERTISEMENT_NUMBER).detail.matchedOn).toBe(
      "official_identifier_list"
    );
  });

  test("falls back to board, title tokens and keywords without an identifier", () => {
    const result = match("UNNUMBERED_FIELD_ASSISTANT_NOTICE", CROWDED_REPOSITORY);
    expect(result.search.identifierBlocked).toBe(false);
    expect(result.search.strategiesUsed).toEqual(
      expect.arrayContaining([SEARCH_STRATEGIES.BOARD_AND_YEAR, SEARCH_STRATEGIES.TITLE_TOKENS])
    );
    expect(result.ranking.ranked.length).toBeGreaterThanOrEqual(2);
  });

  test("reports an empty repository instead of inventing candidates", () => {
    const result = match("UPPSC_NEW_RECRUITMENT", []);
    expect(result.search.isEmptyRepository).toBe(true);
    expect(result.ranking.ranked).toHaveLength(0);
    expect(result.recommendation.bestMatch).toBeNull();
    expect(result.recommendation.recommendation).toBe(RECOMMENDATIONS.CREATE_NEW);
  });

  test("honours an explicit recruitment hint", () => {
    const identity = buildEventIdentity(
      analyzeGovernmentNotice(AI2_NOTICES.SSC_ADMIT_CARD, { now: NOW }).normalizedEvent
    );
    const search = searchCandidates(identity, RECRUITMENTS, {
      existingRecruitmentId: "REC-DSSSB-JE-2025"
    });
    expect(search.candidates.map((candidate) => candidate.record.recruitmentId)).toContain(
      "REC-DSSSB-JE-2025"
    );
    expect(search.strategiesUsed).toContain(SEARCH_STRATEGIES.EXPLICIT_HINT);
  });

  test("caps the candidate list", () => {
    const identity = buildEventIdentity(
      analyzeGovernmentNotice(AI2_NOTICES.UPPSC_NEW_RECRUITMENT, { now: NOW }).normalizedEvent
    );
    const search = searchCandidates(identity, CROWDED_REPOSITORY, { maxCandidates: 2 });
    expect(search.candidates).toHaveLength(2);
    expect(search.truncated).toBe(true);
  });
});

describe("Phase AI-3 similarity engine", () => {
  test("factor weights sum to exactly 1.00", () => {
    const total = Object.values(FACTOR_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(Number(total.toFixed(2))).toBe(1);
    expect(Object.keys(FACTOR_WEIGHTS).sort()).toEqual(Object.values(SIMILARITY_FACTORS).sort());
  });

  test("every score is normalized to 0.00–1.00 with a quality level", () => {
    for (const name of Object.keys(ALL_NOTICES)) {
      const recommendation = recommend(name, CROWDED_REPOSITORY);
      for (const candidate of recommendation.candidates) {
        expect(candidate.score).toBeGreaterThanOrEqual(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
        expect(Object.values(MATCH_QUALITY)).toContain(candidate.level);
      }
    }
  });

  test("an exact advertisement number produces a strong match", () => {
    const recommendation = recommend("UPPSC_UPPER_ADMIT_CARD");
    const advertisement = factorOf(recommendation, SIMILARITY_FACTORS.ADVERTISEMENT_NUMBER);
    expect(advertisement.status).toBe(FACTOR_STATUS.MATCH);
    expect(advertisement.contribution).toBe(FACTOR_WEIGHTS[SIMILARITY_FACTORS.ADVERTISEMENT_NUMBER]);
    expect(recommendation.bestMatch.score).toBeGreaterThanOrEqual(MATCH_THRESHOLDS.STRONG);
    expect(recommendation.matchQualityLevel).toBe(MATCH_QUALITY.STRONG);
  });

  test("an exact reference number matches an advertisement-numbered event", () => {
    const recommendation = recommend("SSC_ADMIT_CARD");
    expect(recommendation.bestMatch.recruitmentId).toBe("REC-SSC-GD-2026");
    expect(recommendation.bestMatch.similarity.identifierMatched).toBe(true);
  });

  test("same board and different recruitment scores weakly despite the shared board", () => {
    const recommendation = recommend("UPPSC_SAME_BOARD_OTHER_RECRUITMENT");
    expect(factorOf(recommendation, SIMILARITY_FACTORS.BOARD).status).toBe(FACTOR_STATUS.MATCH);
    expect(recommendation.bestMatch.similarity.titleSimilarity).toBeLessThan(0.4);
    expect(recommendation.bestMatch.score).toBeLessThan(MATCH_THRESHOLDS.PROBABLE);
  });

  test("a conflicting advertisement number is capped and flagged", () => {
    const record = normalizeRecruitmentRecord(RECRUITMENTS[0]);
    const identity = buildEventIdentity(
      analyzeGovernmentNotice(AI3_NOTICES.UPPSC_UPPER_NEW_CYCLE, { now: NOW }).normalizedEvent
    );
    const similarity = scoreSimilarity(identity, record);
    expect(similarity.conflicts.identifier).toBe(true);
    expect(similarity.score).toBeLessThanOrEqual(IDENTIFIER_CONFLICT_CEILING);
  });

  test("the conflict ceiling holds even when everything else agrees", () => {
    const record = normalizeRecruitmentRecord({
      recruitmentId: "REC-TWIN",
      recruitmentName: "UPPSC Combined State / Upper Subordinate Services Examination 2026",
      organization: "Uttar Pradesh Public Service Commission",
      boardCode: "UPPSC",
      advertisementNumber: "A-9/E-1/2026",
      year: 2026,
      category: "state_psc",
      keywords: ["UPPSC", "Naib Tehsildar", "Block Development Officer"]
    });
    const identity = buildEventIdentity(
      analyzeGovernmentNotice(AI2_NOTICES.UPPSC_NEW_RECRUITMENT, { now: NOW }).normalizedEvent
    );
    const similarity = scoreSimilarity(identity, record);
    expect(similarity.rawScore).toBeGreaterThan(IDENTIFIER_CONFLICT_CEILING);
    expect(similarity.score).toBe(IDENTIFIER_CONFLICT_CEILING);
    expect(similarity.adjustments.map((entry) => entry.code)).toContain("IDENTIFIER_CONFLICT_CAP");
  });

  test("an identifier absent from the recruitment's records counts as disagreement", () => {
    const recommendation = recommend("ORPHAN_ADMIT_CARD");
    const advertisement = factorOf(recommendation, SIMILARITY_FACTORS.ADVERTISEMENT_NUMBER);
    expect(advertisement.status).toBe(FACTOR_STATUS.MISMATCH);
    expect(advertisement.detail.reason).toBe("not_among_recorded_identifiers");
    expect(recommendation.bestMatch.similarity.conflicts.identifierUnrecorded).toBe(true);
  });

  test("penalises a match that no identifier could corroborate", () => {
    const result = match("UNNUMBERED_FIELD_ASSISTANT_NOTICE", CROWDED_REPOSITORY);
    const similarity = result.ranking.best.similarity;
    expect(similarity.identifierComparable).toBe(false);
    expect(similarity.adjustments.map((entry) => entry.code)).toContain("NO_IDENTIFIER_COMPARABLE");
    expect(similarity.score).toBeLessThan(similarity.rawScore);
  });

  test("ranks candidates and reports the separation between the top two", () => {
    const identity = buildEventIdentity(
      analyzeGovernmentNotice(AI2_NOTICES.UPPSC_NEW_RECRUITMENT, { now: NOW }).normalizedEvent
    );
    const search = searchCandidates(identity, RECRUITMENTS);
    const ranking = rankCandidates(identity, search.candidates);
    expect(ranking.best.recruitmentId).toBe("REC-UPPSC-UPPER-2026");
    expect(ranking.ranked[0].score).toBeGreaterThanOrEqual(ranking.ranked[1].score);
    expect(ranking.separation).toBeGreaterThan(0);
  });

  test("title similarity ignores lifecycle words and the year", () => {
    const base = "UPPSC Combined State / Upper Subordinate Services Examination 2026";
    expect(
      titleSimilarity(`${base} — Admit Card released`, base).score
    ).toBe(1);
    expect(titleSimilarity("UPPSC Review Officer Examination 2025", base).score).toBeLessThan(0.4);
  });

  test("identifier comparison folds punctuation and Devanagari characters", () => {
    expect(compareIdentifiers("A-1/E-1/2026", "A 1 / E 1 / 2026").status).toBe(FACTOR_STATUS.MATCH);
    expect(compareIdentifiers("ए-2/ई-1/2025", "A-2/E-1/2025").status).toBe(FACTOR_STATUS.MATCH);
    expect(compareIdentifiers("05/2026", "18/2026").status).toBe(FACTOR_STATUS.MISMATCH);
  });

  test("organizations sharing only generic words do not match outright", () => {
    const comparison = compareOrganizations(
      { name: "Jharkhand Staff Selection Commission" },
      { name: "Bihar Staff Selection Commission" }
    );
    expect(comparison.status).not.toBe(FACTOR_STATUS.MATCH);
  });
});

describe("Phase AI-3 update classification", () => {
  const RELATIONSHIP_CASES = [
    ["UPPSC_NEW_RECRUITMENT", UPDATE_RELATIONSHIPS.NOTIFICATION],
    ["UPPSC_APPLY_ONLINE", UPDATE_RELATIONSHIPS.APPLY_ONLINE],
    ["NTA_CORRECTION_WINDOW", UPDATE_RELATIONSHIPS.CORRECTION],
    ["DSSSB_CORRIGENDUM", UPDATE_RELATIONSHIPS.CORRECTION],
    ["BPSC_EXTENSION", UPDATE_RELATIONSHIPS.EXTENSION],
    ["MIXED_LANGUAGE_EXTENSION", UPDATE_RELATIONSHIPS.EXTENSION],
    ["SSC_ADMIT_CARD", UPDATE_RELATIONSHIPS.ADMIT_CARD],
    ["SSC_EXAM_DATE", UPDATE_RELATIONSHIPS.EXAM_DATE],
    ["NTA_EXAM_CITY", UPDATE_RELATIONSHIPS.EXAM_CITY],
    ["UPPSC_ANSWER_KEY", UPDATE_RELATIONSHIPS.ANSWER_KEY],
    ["RAILWAY_TECHNICIAN_RESULT", UPDATE_RELATIONSHIPS.RESULT],
    ["UP_POLICE_FINAL_RESULT", UPDATE_RELATIONSHIPS.FINAL_RESULT],
    ["RRB_DV_SCHEDULE", UPDATE_RELATIONSHIPS.DV],
    ["UP_POLICE_JOINING", UPDATE_RELATIONSHIPS.JOINING],
    ["TENDER_NOTICE", UPDATE_RELATIONSHIPS.NONE]
  ];

  test.each(RELATIONSHIP_CASES)("classifies %s as %s", (fixtureName, expected) => {
    const { normalizedEvent } = analyzeGovernmentNotice(ALL_NOTICES[fixtureName], { now: NOW });
    const relationship = classifyUpdateRelationship(normalizedEvent);
    expect(relationship.relationship).toBe(expected);
    expect(relationship.explanation).toBeTruthy();
  });

  test("covers every relationship in the required list", () => {
    const required = [
      UPDATE_RELATIONSHIPS.NOTIFICATION,
      UPDATE_RELATIONSHIPS.APPLY_ONLINE,
      UPDATE_RELATIONSHIPS.CORRECTION,
      UPDATE_RELATIONSHIPS.EXTENSION,
      UPDATE_RELATIONSHIPS.ADMIT_CARD,
      UPDATE_RELATIONSHIPS.EXAM_DATE,
      UPDATE_RELATIONSHIPS.EXAM_CITY,
      UPDATE_RELATIONSHIPS.ANSWER_KEY,
      UPDATE_RELATIONSHIPS.RESULT,
      UPDATE_RELATIONSHIPS.FINAL_RESULT,
      UPDATE_RELATIONSHIPS.DV,
      UPDATE_RELATIONSHIPS.JOINING
    ];
    const classified = new Set(
      Object.keys(ALL_NOTICES).map(
        (name) =>
          classifyUpdateRelationship(
            analyzeGovernmentNotice(ALL_NOTICES[name], { now: NOW }).normalizedEvent
          ).relationship
      )
    );
    const missing = required.filter((relationship) => !classified.has(relationship));
    expect(missing).toEqual([]);
  });

  test("falls back to the title when the event type is unhelpful", () => {
    const joining = classifyUpdateRelationship({
      eventType: "unknown",
      normalizedTitle: "SSC CGL 2025 — Appointment Letter and Joining Instructions"
    });
    expect(joining.relationship).toBe(UPDATE_RELATIONSHIPS.JOINING);
    expect(joining.source).toBe("title_pattern");

    const hindiAnswerKey = classifyUpdateRelationship({
      eventType: "unknown",
      normalizedTitle: "उत्तर कुंजी जारी"
    });
    expect(hindiAnswerKey.relationship).toBe(UPDATE_RELATIONSHIPS.ANSWER_KEY);
  });

  test("a result notice mentioning verification stays a result", () => {
    const { normalizedEvent } = analyzeGovernmentNotice(AI2_NOTICES.UP_POLICE_FINAL_RESULT, { now: NOW });
    expect(classifyUpdateRelationship(normalizedEvent).relationship).toBe(
      UPDATE_RELATIONSHIPS.FINAL_RESULT
    );
  });

  test("maps an update onto the matched recruitment and its next lifecycle stage", () => {
    const { recommendation } = match("UPPSC_UPPER_ADMIT_CARD");
    expect(recommendation.updateMapping).toMatchObject({
      mapped: true,
      relationship: UPDATE_RELATIONSHIPS.ADMIT_CARD,
      recruitmentId: "REC-UPPSC-UPPER-2026",
      fromLifecycleStage: "apply_online",
      toLifecycleStage: UPDATE_RELATIONSHIPS.ADMIT_CARD,
      isNewStageForRecruitment: true
    });
    expect(recommendation.updateMapping.plausibility.plausible).toBe(true);
  });

  test("moving forward is plausible and jumping far backwards is not", () => {
    const record = normalizeRecruitmentRecord(RECRUITMENTS[1]); // 2025 cycle, final_result
    const relationship = (name, order) => ({
      relationship: name,
      label: name,
      lifecycleOrder: order,
      isRecruitmentRelated: true,
      resolved: true
    });

    const forward = assessLifecyclePlausibility(
      relationship(UPDATE_RELATIONSHIPS.JOINING, 90),
      record
    );
    expect(forward.plausible).toBe(true);
    expect(forward.level).toBe("plausible");

    // One step back is normal in multi-tier exams.
    const oneStepBack = assessLifecyclePlausibility(
      relationship(UPDATE_RELATIONSHIPS.RESULT, 60),
      record
    );
    expect(oneStepBack.plausible).toBe(true);
    expect(oneStepBack.level).toBe("plausible_backward");

    const farBack = assessLifecyclePlausibility(
      relationship(UPDATE_RELATIONSHIPS.APPLY_ONLINE, 20),
      record
    );
    expect(farBack.plausible).toBe(false);
    expect(farBack.reason).toBeTruthy();
  });

  test("a corrigendum is plausible at any stage", () => {
    const record = normalizeRecruitmentRecord(RECRUITMENTS[1]);
    const correction = assessLifecyclePlausibility(
      {
        relationship: UPDATE_RELATIONSHIPS.CORRECTION,
        label: "Correction",
        lifecycleOrder: 25,
        occursAnytime: true,
        isRecruitmentRelated: true,
        resolved: true
      },
      record
    );
    expect(correction.plausible).toBe(true);
  });

  test("mapping reports no candidate when nothing matched", () => {
    const mapping = mapUpdateToCandidate(
      { relationship: UPDATE_RELATIONSHIPS.ADMIT_CARD, label: "Admit Card" },
      null
    );
    expect(mapping.mapped).toBe(false);
    expect(mapping.recruitmentId).toBeNull();
  });

  test("detects a re-published document already recorded against the recruitment", () => {
    const { duplicate, recommendation } = match("UPPSC_NEW_RECRUITMENT");
    expect(duplicate.isDuplicate).toBe(true);
    expect(duplicate.matchedOn).toBe("relationship_identifier_and_date");
    expect(duplicate.recordedDocument.publicationDate).toBe("2025-09-04");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.POSSIBLE_DUPLICATE);
  });

  test("a later document against the same recruitment is not a duplicate", () => {
    const identity = buildEventIdentity(
      analyzeGovernmentNotice(AI3_NOTICES.UPPSC_UPPER_ADMIT_CARD, { now: NOW }).normalizedEvent
    );
    const duplicate = findRecordedDuplicate(
      identity,
      normalizeRecruitmentRecord(RECRUITMENTS[0]),
      { relationship: UPDATE_RELATIONSHIPS.ADMIT_CARD, label: "Admit Card" }
    );
    expect(duplicate.isDuplicate).toBe(false);
  });
});

describe("Phase AI-3 recommendation engine", () => {
  test("emits only the six permitted recommendations", () => {
    const allowed = Object.values(RECOMMENDATIONS);
    for (const rule of RULES) {
      expect(allowed).toContain(rule.recommendation);
    }
    for (const name of Object.keys(ALL_NOTICES)) {
      expect(allowed).toContain(recommend(name, CROWDED_REPOSITORY).recommendation);
    }
  });

  test("every rule id is declared in the taxonomy and used at most once", () => {
    const ids = RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(Object.values(RULE_IDS)).toContain(id);
    }
  });

  test("every recommendation carries an explanation naming its evidence", () => {
    for (const name of Object.keys(ALL_NOTICES)) {
      const recommendation = recommend(name, CROWDED_REPOSITORY);
      expect(typeof recommendation.explanation).toBe("string");
      expect(recommendation.explanation.length).toBeGreaterThan(40);
      expect(recommendation.recommendationLabel).toBeTruthy();
      expect(recommendation.ruleId).toBeTruthy();
    }
  });

  const OUTCOME_CASES = [
    ["BHU_ASSISTANT_PROFESSOR", RECOMMENDATIONS.CREATE_NEW, RULE_IDS.NO_MATCH_NEW_RECRUITMENT],
    ["UPPSC_UPPER_ADMIT_CARD", RECOMMENDATIONS.UPDATE_EXISTING, RULE_IDS.STRONG_MATCH_UPDATE],
    ["UPPSC_NEW_RECRUITMENT", RECOMMENDATIONS.POSSIBLE_DUPLICATE, RULE_IDS.DUPLICATE_OF_RECORDED_DOCUMENT],
    ["ORPHAN_ADMIT_CARD", RECOMMENDATIONS.HUMAN_REVIEW, RULE_IDS.ORPHAN_UPDATE_EVENT],
    ["TENDER_NOTICE", RECOMMENDATIONS.IGNORE, RULE_IDS.NON_RECRUITMENT_EVENT],
    ["PRESS_RELEASE", RECOMMENDATIONS.IGNORE, RULE_IDS.NON_RECRUITMENT_EVENT],
    ["UPPSC_UPPER_NEW_CYCLE", RECOMMENDATIONS.CREATE_NEW, RULE_IDS.NEW_CYCLE_OF_KNOWN_RECRUITMENT],
    ["UPPSC_SAME_BOARD_OTHER_RECRUITMENT", RECOMMENDATIONS.CREATE_NEW, RULE_IDS.WEAK_MATCH_NEW_RECRUITMENT],
    ["UNKNOWN_NOTICE", RECOMMENDATIONS.HUMAN_REVIEW, RULE_IDS.VERY_LOW_EVENT_CONFIDENCE]
  ];

  test.each(OUTCOME_CASES)("%s recommends %s via %s", (fixtureName, expected, ruleId) => {
    const recommendation = recommend(fixtureName);
    expect(recommendation.recommendation).toBe(expected);
    expect(recommendation.ruleId).toBe(ruleId);
  });

  test("MERGE_CANDIDATE is reached without identifier corroboration", () => {
    const decision = evaluateRecommendation({
      identity: { title: "BSSC Field Assistant Recruitment 2026", year: 2026, eventConfidence: 0.8 },
      relationship: {
        relationship: UPDATE_RELATIONSHIPS.APPLY_ONLINE,
        label: "Apply Online",
        isUpdate: true,
        resolved: true,
        requiresExistingRecruitment: true
      },
      search: { repositorySize: 1 },
      ranking: {
        ranked: [{}],
        strongMatches: [],
        best: {
          recruitmentId: "REC-BSSC-FIELD-ASSISTANT-A",
          score: 0.7,
          level: MATCH_QUALITY.PROBABLE,
          record: { title: "BSSC Field Assistant Recruitment 2026", year: 2026 },
          similarity: {
            score: 0.7,
            identifierMatched: false,
            conflicts: { identifier: false, department: false, year: false },
            matchedFactors: ["board", "title", "year"],
            title: { score: 1 }
          }
        }
      },
      duplicate: null,
      plausibility: { plausible: true }
    });
    expect(decision.recommendation).toBe(RECOMMENDATIONS.MERGE_CANDIDATE);
    expect(decision.ruleId).toBe(RULE_IDS.PROBABLE_MATCH_WITHOUT_IDENTIFIER);
  });

  test("ambiguity between two strong matches goes to human review", () => {
    const recommendation = recommend("UNNUMBERED_FIELD_ASSISTANT_NOTICE", CROWDED_REPOSITORY);
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.HUMAN_REVIEW);
    expect(recommendation.ruleId).toBe(RULE_IDS.AMBIGUOUS_MULTIPLE_STRONG_MATCHES);
    expect(recommendation.explanation).toMatch(/REC-BSSC-FIELD-ASSISTANT-[AB]/);
  });

  test("records the rules that also fired as alternatives", () => {
    const recommendation = recommend("UPPSC_UPPER_ADMIT_CARD");
    expect(Array.isArray(recommendation.alternativesConsidered)).toBe(true);
    for (const alternative of recommendation.alternativesConsidered) {
      expect(alternative.ruleId).not.toBe(recommendation.ruleId);
      expect(Object.values(RECOMMENDATIONS)).toContain(alternative.recommendation);
    }
  });

  test("explanations read as sentences without broken articles", () => {
    for (const name of Object.keys(ALL_NOTICES)) {
      const { explanation } = recommend(name, CROWDED_REPOSITORY);
      expect(explanation).not.toMatch(/\ba (?:[AEIOU])/);
      expect(explanation).not.toMatch(/undefined|null|NaN/);
      expect(explanation.trim().endsWith(".")).toBe(true);
    }
  });
});

describe("Phase AI-3 confidence", () => {
  test("reports candidate selection, match quality and recommendation confidence", () => {
    const { confidence } = recommend("UPPSC_UPPER_ADMIT_CARD");
    for (const dimension of ["candidateSelection", "matchQuality", "recommendation"]) {
      expect(confidence[dimension].score).toBeGreaterThanOrEqual(0);
      expect(confidence[dimension].score).toBeLessThanOrEqual(1);
      expect(confidence[dimension].level).toBeTruthy();
      expect(confidence[dimension].reasons.length).toBeGreaterThan(0);
      for (const reason of confidence[dimension].reasons) {
        expect(reason).toMatchObject({ code: expect.any(String), detail: expect.any(String) });
      }
    }
    expect(confidence.overallScore).toBeGreaterThan(0.9);
  });

  test("all three scores stay inside range for every fixture", () => {
    for (const name of Object.keys(ALL_NOTICES)) {
      const { confidence } = recommend(name, CROWDED_REPOSITORY);
      for (const dimension of ["candidateSelection", "matchQuality", "recommendation"]) {
        expect(confidence[dimension].score).toBeGreaterThanOrEqual(0);
        expect(confidence[dimension].score).toBeLessThanOrEqual(1);
      }
      expect(confidence.overallScore).toBeGreaterThanOrEqual(0);
      expect(confidence.overallScore).toBeLessThanOrEqual(1);
    }
  });

  test("an exact identifier raises match quality, a conflict lowers it", () => {
    const strong = recommend("UPPSC_UPPER_ADMIT_CARD").confidence.matchQuality.score;
    const conflicted = recommend("UPPSC_UPPER_NEW_CYCLE").confidence.matchQuality.score;
    expect(strong).toBeGreaterThan(conflicted);
    expect(recommend("UPPSC_UPPER_ADMIT_CARD").confidence.matchQuality.reasons.map((r) => r.code)).toContain(
      "EXACT_ADVERTISEMENT_NUMBER"
    );
  });

  test("a weak match supports CREATE_NEW instead of undermining it", () => {
    const { confidence } = recommend("BHU_ASSISTANT_PROFESSOR");
    expect(confidence.evidenceDependency).toBe("absence_of_match");
    expect(confidence.evidenceAlignment).toBeGreaterThan(confidence.matchQuality.score);
    expect(confidence.overallScore).toBeGreaterThan(0.6);
  });

  test("a crowded, undecidable candidate set lowers candidate-selection confidence", () => {
    const crowded = recommend("UNNUMBERED_FIELD_ASSISTANT_NOTICE", CROWDED_REPOSITORY).confidence;
    const clean = recommend("UPPSC_UPPER_ADMIT_CARD").confidence;
    expect(crowded.candidateSelection.score).toBeLessThan(clean.candidateSelection.score);
  });

  test("validation flags reduce recommendation confidence", () => {
    const parts = {
      rule: { id: RULE_IDS.STRONG_MATCH_UPDATE, baseConfidence: 0.9, dependsOn: "match" },
      candidateSelection: scoreCandidateSelection({ repositorySize: 1 }, { ranked: [{}] }),
      matchQuality: scoreMatchQuality(null, null),
      identity: { eventConfidence: 0.9 }
    };
    const { scoreRecommendation } = require("../server/lib/recruitmentMatching");
    const clean = scoreRecommendation({ ...parts, validationFlags: [] });
    const flagged = scoreRecommendation({
      ...parts,
      validationFlags: [VALIDATION_CODES.MULTIPLE_STRONG_MATCHES, VALIDATION_CODES.AMBIGUOUS_TITLE]
    });
    expect(flagged.score).toBeLessThan(clean.score);
  });
});

describe("Phase AI-3 validation", () => {
  test("flags multiple strong matches", () => {
    const { validation } = recommend("UNNUMBERED_FIELD_ASSISTANT_NOTICE", CROWDED_REPOSITORY);
    expect(validation.flags).toContain(VALIDATION_CODES.MULTIPLE_STRONG_MATCHES);
    expect(validation.requiresHumanReview).toBe(true);
  });

  test("flags a missing advertisement number", () => {
    const { validation } = recommend("UNNUMBERED_FIELD_ASSISTANT_NOTICE", CROWDED_REPOSITORY);
    expect(validation.flags).toContain(VALIDATION_CODES.MISSING_ADVERTISEMENT_NUMBER);
    expect(validation.summary.hasIdentifier).toBe(false);
  });

  test("flags conflicting departments", () => {
    // Same post, same year, different state's commission: the title pulls the
    // record in as a candidate and the recruiting body contradicts it.
    const impostor = {
      recruitmentId: "REC-BSSC-LEKHPAL-2026",
      recruitmentName: "BSSC Lekhpal Recruitment 2026",
      organization: "Bihar Staff Selection Commission",
      boardCode: "BSSC",
      advertisementNumber: "BSSC/LEK/02/2026",
      year: 2026,
      postNames: ["Lekhpal"],
      keywords: ["BSSC", "Lekhpal"]
    };
    const recommendation = recommend("MIXED_LANGUAGE_EXTENSION", [impostor]);
    expect(recommendation.bestMatch.recruitmentId).toBe("REC-BSSC-LEKHPAL-2026");
    expect(recommendation.bestMatch.similarity.conflicts.department).toBe(true);
    expect(recommendation.validation.flags).toContain(VALIDATION_CODES.CONFLICTING_DEPARTMENTS);
    expect(recommendation.recommendation).not.toBe(RECOMMENDATIONS.UPDATE_EXISTING);
  });

  test("reports conflicts with an already-rejected candidate as information only", () => {
    const recommendation = recommend("AIIMS_NURSING_WALK_IN");
    expect(recommendation.bestMatch.score).toBeLessThan(MATCH_THRESHOLDS.WEAK);
    const conflicts = recommendation.validation.issues.filter((entry) =>
      [VALIDATION_CODES.CONFLICTING_DEPARTMENTS, VALIDATION_CODES.IDENTIFIER_CONFLICT].includes(
        entry.code
      )
    );
    expect(conflicts.length).toBeGreaterThan(0);
    for (const conflict of conflicts) {
      expect(conflict.severity).toBe(VALIDATION_SEVERITY.INFO);
    }
    expect(recommendation.validation.requiresHumanReview).toBe(false);
  });

  test("flags low confidence", () => {
    const { validation } = recommend("UNKNOWN_NOTICE");
    expect(validation.flags).toContain(VALIDATION_CODES.LOW_CONFIDENCE);
  });

  test("flags an ambiguous title", () => {
    expect(assessTitleAmbiguity("Important Notice").ambiguous).toBe(true);
    expect(assessTitleAmbiguity("UPPSC Combined State Upper Subordinate Services Examination 2026").ambiguous).toBe(
      false
    );
    const validation = validateMatching({
      identity: { title: "Important Notice" },
      relationship: { relationship: UPDATE_RELATIONSHIPS.UNKNOWN },
      search: { repositorySize: 3 },
      ranking: { ranked: [] },
      eventConfidence: 0.5
    });
    expect(validation.flags).toContain(VALIDATION_CODES.AMBIGUOUS_TITLE);
  });

  test("flags a year mismatch on an otherwise matching title", () => {
    const { validation } = recommend("UPPSC_UPPER_NEW_CYCLE");
    expect(validation.flags).toContain(VALIDATION_CODES.YEAR_MISMATCH_ON_MATCHING_TITLE);
    expect(validation.flags).toContain(VALIDATION_CODES.IDENTIFIER_CONFLICT);
  });

  test("flags an orphan update", () => {
    const { validation } = recommend("ORPHAN_ADMIT_CARD");
    expect(validation.flags).toContain(VALIDATION_CODES.ORPHAN_UPDATE_EVENT);
  });

  test("never raises an error severity, because validation is advisory", () => {
    for (const name of Object.keys(ALL_NOTICES)) {
      const { validation } = recommend(name, CROWDED_REPOSITORY);
      expect(validation.errorCount).toBe(0);
      expect(validation.ok).toBe(true);
      for (const issue of validation.issues) {
        expect([VALIDATION_SEVERITY.WARNING, VALIDATION_SEVERITY.INFO]).toContain(issue.severity);
      }
    }
  });
});

describe("Phase AI-3 required scenarios", () => {
  test("new recruitment", () => {
    const recommendation = recommend("BHU_ASSISTANT_PROFESSOR");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.CREATE_NEW);
    expect(recommendation.updateRelationship.relationship).toBe(UPDATE_RELATIONSHIPS.NOTIFICATION);
    expect(recommendation.bestMatch).toBeNull();
  });

  test("existing recruitment update", () => {
    const recommendation = recommend("BPSC_EXTENSION");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.UPDATE_EXISTING);
    expect(recommendation.bestMatch.recruitmentId).toBe("REC-BPSC-71CCE-2026");
    expect(recommendation.updateRelationship.relationship).toBe(UPDATE_RELATIONSHIPS.EXTENSION);
  });

  test("duplicate notice", () => {
    const recommendation = recommend("UPPSC_NEW_RECRUITMENT");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.POSSIBLE_DUPLICATE);
    expect(recommendation.duplicate.isDuplicate).toBe(true);
    expect(recommendation.explanation).toMatch(/already recorded/i);
  });

  test("admit card", () => {
    const recommendation = recommend("SSC_ADMIT_CARD");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.UPDATE_EXISTING);
    expect(recommendation.updateRelationship.relationship).toBe(UPDATE_RELATIONSHIPS.ADMIT_CARD);
    expect(recommendation.updateMapping.toLifecycleStage).toBe(UPDATE_RELATIONSHIPS.ADMIT_CARD);
  });

  test("result", () => {
    const recommendation = recommend("RAILWAY_TECHNICIAN_RESULT");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.UPDATE_EXISTING);
    expect(recommendation.updateRelationship.relationship).toBe(UPDATE_RELATIONSHIPS.RESULT);
    expect(recommendation.bestMatch.recruitmentId).toBe("REC-RRB-TECH-2025");
  });

  test("final result", () => {
    const recommendation = recommend("UP_POLICE_FINAL_RESULT");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.UPDATE_EXISTING);
    expect(recommendation.updateRelationship.relationship).toBe(UPDATE_RELATIONSHIPS.FINAL_RESULT);
  });

  test("correction", () => {
    const recommendation = recommend("NTA_CORRECTION_WINDOW");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.UPDATE_EXISTING);
    expect(recommendation.updateRelationship.relationship).toBe(UPDATE_RELATIONSHIPS.CORRECTION);
    expect(recommendation.updateRelationship.occursAnytime).toBe(true);
  });

  test("extension", () => {
    const recommendation = recommend("DSSSB_CORRIGENDUM");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.UPDATE_EXISTING);
    expect(recommendation.bestMatch.recruitmentId).toBe("REC-DSSSB-JE-2025");
  });

  test("same title, different year", () => {
    const recommendation = recommend("UPPSC_UPPER_NEW_CYCLE");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.CREATE_NEW);
    expect(recommendation.bestMatch.similarity.titleSimilarity).toBe(1);
    expect(recommendation.bestMatch.similarity.conflicts.year).toBe(true);
    expect(recommendation.explanation).toMatch(/new recruitment cycle/i);
  });

  test("same board, different recruitment", () => {
    const recommendation = recommend("UPPSC_SAME_BOARD_OTHER_RECRUITMENT");
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.CREATE_NEW);
    expect(recommendation.bestMatch.boardCode).toBe("UPPSC");
    expect(recommendation.bestMatch.level).toBe(MATCH_QUALITY.WEAK);
  });

  test("Hindi notice announcing a new recruitment", () => {
    const { recommendation, normalizedEvent } = match("HINDI_NEW_RECRUITMENT");
    expect(normalizedEvent.language).toBe(LANGUAGES.HINDI);
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.CREATE_NEW);
    expect(recommendation.eventIdentity.advertisementNumber).toBe("27/2026");
  });

  test("Hindi notice updating a known recruitment", () => {
    const { recommendation, normalizedEvent } = match("HINDI_HEAVY_RESULT");
    expect(normalizedEvent.language).toBe(LANGUAGES.HINDI);
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.UPDATE_EXISTING);
    expect(recommendation.bestMatch.recruitmentId).toBe("REC-UPPSC-RO-ARO-2025");
    // The Devanagari advertisement number folds onto its Latin equivalent.
    expect(factorOf(recommendation, SIMILARITY_FACTORS.ADVERTISEMENT_NUMBER)).toMatchObject({
      status: FACTOR_STATUS.MATCH,
      detail: { eventValue: "ए-2/ई-1/2025", recordValue: "A-2/E-1/2025" }
    });
  });

  test("mixed-language notice", () => {
    const { recommendation, normalizedEvent } = match("MIXED_LANGUAGE_EXTENSION");
    expect(normalizedEvent.language).toBe(LANGUAGES.MIXED);
    expect(recommendation.recommendation).toBe(RECOMMENDATIONS.UPDATE_EXISTING);
    expect(recommendation.bestMatch.recruitmentId).toBe("REC-UPSSSC-LEKHPAL-2026");
    expect(recommendation.updateRelationship.relationship).toBe(UPDATE_RELATIONSHIPS.EXTENSION);
  });
});

describe("Phase AI-3 output contract", () => {
  test("exposes the required fields", () => {
    const recommendation = recommend("UPPSC_UPPER_ADMIT_CARD");
    const required = [
      "formatId",
      "engineVersion",
      "phase",
      "advisoryOnly",
      "appliesChanges",
      "recommendation",
      "recommendationLabel",
      "explanation",
      "ruleId",
      "updateRelationship",
      "updateMapping",
      "bestMatch",
      "candidates",
      "candidateSearch",
      "confidence",
      "validation",
      "duplicate",
      "eventIdentity"
    ];
    for (const field of required) {
      expect(recommendation).toHaveProperty(field);
    }
    expect(recommendation.formatId).toBe(FORMAT_ID);
    expect(recommendation.engineVersion).toBe(ENGINE_VERSION);
    expect(recommendation.phase).toBe(PHASE);
  });

  test("is immutable and advisory", () => {
    const recommendation = recommend("SSC_ADMIT_CARD");
    expect(Object.isFrozen(recommendation)).toBe(true);
    expect(recommendation.advisoryOnly).toBe(true);
    expect(recommendation.appliesChanges).toBe(false);
    expect(() => {
      "use strict";
      recommendation.recommendation = RECOMMENDATIONS.CREATE_NEW;
    }).toThrow();
  });

  test("accepts a normalized event, an enriched event or a raw monitoring event", () => {
    const raw = AI3_NOTICES.UPPSC_UPPER_ADMIT_CARD;
    const normalized = analyzeGovernmentNotice(raw, { now: NOW }).normalizedEvent;
    const enriched = enrichMonitoringEvent(raw, { now: NOW });

    const fromNormalized = matchRecruitment(normalized, RECRUITMENTS, { now: NOW });
    const fromEnriched = matchRecruitment(enriched, RECRUITMENTS, { now: NOW });
    const fromRaw = matchRecruitment(raw, RECRUITMENTS, { now: NOW });

    expect(fromNormalized.meta.eventSource).toBe("normalized_event");
    expect(fromEnriched.meta.eventSource).toBe("enriched_monitoring_event");
    expect(fromRaw.meta.eventSource).toBe("raw_monitoring_event");
    for (const result of [fromEnriched, fromRaw]) {
      expect(result.recommendation.recommendation).toBe(fromNormalized.recommendation.recommendation);
      expect(result.recommendation.bestMatch.score).toBe(fromNormalized.recommendation.bestMatch.score);
    }
  });

  test("does not mutate the recruitment metadata it is given", () => {
    const snapshot = JSON.stringify(RECRUITMENTS);
    matchRecruitment(
      analyzeGovernmentNotice(AI3_NOTICES.UPPSC_UPPER_ADMIT_CARD, { now: NOW }).normalizedEvent,
      RECRUITMENTS,
      { now: NOW }
    );
    expect(JSON.stringify(RECRUITMENTS)).toBe(snapshot);
  });

  test("a prebuilt index produces the same recommendation", () => {
    const normalized = analyzeGovernmentNotice(AI3_NOTICES.UPPSC_UPPER_ADMIT_CARD, { now: NOW }).normalizedEvent;
    const fromArray = matchRecruitment(normalized, RECRUITMENTS, { now: NOW });
    const fromIndex = matchRecruitment(normalized, buildRecruitmentIndex(RECRUITMENTS), { now: NOW });
    expect(fromIndex.recommendation.recommendation).toBe(fromArray.recommendation.recommendation);
    expect(fromIndex.recommendation.bestMatch.score).toBe(fromArray.recommendation.bestMatch.score);
  });

  test("tolerates an empty event and an empty repository", () => {
    const result = matchRecruitment({}, [], { now: NOW });
    expect(Object.values(RECOMMENDATIONS)).toContain(result.recommendation.recommendation);
    expect(result.recommendation.explanation).toBeTruthy();
  });
});

describe("Phase AI-3 Production Workflow compatibility", () => {
  const originalEvent = Object.freeze({
    sourceUrl: "https://uppsc.up.nic.in/admitcard",
    title: "UPPSC Admit Card 2026",
    contentType: "text/html",
    html: AI3_NOTICES.UPPSC_UPPER_ADMIT_CARD.html,
    forceChangeDetected: true
  });

  test("enrichment is additive and preserves every original key", () => {
    const enriched = enrichEventWithRecommendation(originalEvent, RECRUITMENTS, { now: NOW });
    for (const [key, value] of Object.entries(originalEvent)) {
      expect(enriched[key]).toBe(value);
    }
    expect(Object.keys(enriched)).toHaveLength(Object.keys(originalEvent).length + 1);
    expect(readRecommendation(enriched).recommendation).toBe(RECOMMENDATIONS.UPDATE_EXISTING);
  });

  test("attaching a recommendation does not mutate the event", () => {
    const event = { sourceUrl: "https://example.gov.in", title: "Notice" };
    const snapshot = JSON.stringify(event);
    const attached = attachRecommendation(event, recommend("SSC_ADMIT_CARD"));
    expect(JSON.stringify(event)).toBe(snapshot);
    expect(attached[RECOMMENDATION_FIELD].phase).toBe(PHASE);
    expect(readRecommendation({})).toBeNull();
  });

  test("uses a namespace of its own, alongside Phase AI-2's", () => {
    const enriched = enrichMonitoringEvent(originalEvent, { now: NOW });
    const withRecommendation = enrichEventWithRecommendation(enriched, RECRUITMENTS, { now: NOW });
    expect(RECOMMENDATION_FIELD).toBe("recruitmentMatching");
    expect(withRecommendation.noticeIntelligence).toBe(enriched.noticeIntelligence);
    expect(withRecommendation[RECOMMENDATION_FIELD].phase).toBe(PHASE);
  });

  test("Production Workflow behaves identically with and without a recommendation", async () => {
    const buildEvent = (extra) => ({
      sourceUrl: "https://uppsc.up.nic.in/Notifications.aspx",
      title: "UPPSC Combined State Upper Subordinate Services Examination 2026",
      contentType: "text/html",
      html: AI2_NOTICES.UPPSC_NEW_RECRUITMENT.html,
      forceChangeDetected: true,
      allowTelegramDelivery: true,
      telegramTransport: telegramNotification.createMemoryTransport(),
      ...extra
    });

    const baseline = await runProductionWorkflow({
      monitoringEvent: buildEvent(),
      workflowId: "ai3_compat_baseline"
    });
    const enriched = await runProductionWorkflow({
      monitoringEvent: enrichEventWithRecommendation(buildEvent(), RECRUITMENTS, { now: NOW }),
      workflowId: "ai3_compat_enriched"
    });

    expect(enriched.status).toBe(baseline.status);
    expect(enriched.finalState).toBe(baseline.finalState);
    expect(enriched.published).toBe(baseline.published);
    expect(enriched.autoPublishBlocked).toBe(baseline.autoPublishBlocked);
    const stageStatuses = (result) =>
      Object.entries(result.stageResults).map(([stageId, stage]) => [stageId, stage.status]);
    expect(stageStatuses(enriched)).toEqual(stageStatuses(baseline));
    expect(baseline.status).toBe(STAGE_STATUS.SUCCESS);
    expect(baseline.finalState).toBe(WORKFLOW_STATES.READY_FOR_REVIEW);
  });

  test("a recommendation of UPDATE_EXISTING changes nothing about the run", async () => {
    const buildEvent = () => ({
      sourceUrl: "https://uppsc.up.nic.in/admitcard",
      title: "UPPSC Admit Card 2026",
      contentType: "text/html",
      html: AI3_NOTICES.UPPSC_UPPER_ADMIT_CARD.html,
      forceChangeDetected: true,
      allowTelegramDelivery: true,
      telegramTransport: telegramNotification.createMemoryTransport()
    });

    const advised = enrichEventWithRecommendation(buildEvent(), RECRUITMENTS, { now: NOW });
    expect(readRecommendation(advised).recommendation).toBe(RECOMMENDATIONS.UPDATE_EXISTING);

    const baseline = await runProductionWorkflow({
      monitoringEvent: buildEvent(),
      workflowId: "ai3_advisory_baseline"
    });
    const enriched = await runProductionWorkflow({
      monitoringEvent: advised,
      workflowId: "ai3_advisory_enriched"
    });

    // The recommendation says "update an existing recruitment" and the workflow
    // still reaches exactly the state it reached without the advice.
    expect(enriched.finalState).toBe(baseline.finalState);
    expect(enriched.published).toBe(false);
    expect(baseline.published).toBe(false);
  });

  test("AUTO_PUBLISH remains disabled", () => {
    expect(getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
  });
});
