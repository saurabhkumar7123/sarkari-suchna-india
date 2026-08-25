"use strict";

/**
 * Recruitment lifecycle safety contracts — creation, matching, isolation,
 * publish policy, document revision, page snapshot helpers.
 * No live monitoring / Telegram / publish.
 */

const {
  evaluateRecruitmentCreation,
  resolvePersistenceDecision,
  guardPersistenceCreateDecision,
  MATCH_LEVELS,
  PERSISTENCE_DECISIONS,
  CREATION_MODES
} = require("../server/lib/recruitment/lifecycleSafety");
const { evaluateLifecycleMatch } = require("../server/lib/recruitment/lifecycleMatching");
const { resolvePublishPolicy, PUBLISH_TARGETS } = require("../server/lib/recruitment/lifecyclePublishPolicy");
const {
  evaluateDocumentRevision,
  hashDocumentBytes
} = require("../server/lib/recruitment/lifecycleDocumentIdentity");
const { buildPageSnapshot } = require("../server/lib/recruitment/pageSnapshot");
const { getAutomationFlags } = require("../server/config/automationFlags");

describe("recruitment lifecycle engine", () => {
  test("A: new announcement with high identity is CREATE_ELIGIBLE", () => {
    const creation = evaluateRecruitmentCreation({
      eventType: "notification",
      matchLevel: MATCH_LEVELS.NO_MATCH,
      identity: {
        advertisementNo: "CGL-01/2026",
        organization: "SSC",
        examName: "CGL",
        recruitmentYear: 2026
      }
    });
    expect(creation.allowed).toBe(true);
    expect(creation.mode).toBe(CREATION_MODES.ELIGIBLE);
  });

  test("B: admit card without parent never creates recruitment", () => {
    const creation = evaluateRecruitmentCreation({
      eventType: "admit_card",
      matchLevel: MATCH_LEVELS.NO_MATCH,
      identity: { organization: "SSC", examName: "CGL", recruitmentYear: 2026 }
    });
    expect(creation.allowed).toBe(false);
    const persistence = resolvePersistenceDecision({
      eventType: "admit_card",
      matchLevel: MATCH_LEVELS.NO_MATCH,
      identity: {}
    });
    expect(persistence.decision).toBe(PERSISTENCE_DECISIONS.NEEDS_MATCHING);
  });

  test("C: result without parent never creates recruitment", () => {
    const creation = evaluateRecruitmentCreation({
      eventType: "result",
      matchLevel: MATCH_LEVELS.NO_MATCH,
      identity: { advertisementNo: "CGL-01/2026" }
    });
    expect(creation.allowed).toBe(false);
    expect(
      guardPersistenceCreateDecision("CREATE_NEW_RECRUITMENT", "result").blocked
    ).toBe(true);
  });

  test("D: strong recruitment match attaches HIGH", () => {
    const evaluation = evaluateLifecycleMatch({
      notice: {
        title: "SSC CGL 2026 Admit Card",
        organization: "SSC",
        advertisementNo: "CGL-01/2026",
        examName: "CGL",
        recruitmentYear: 2026
      },
      recruitmentCandidates: [
        {
          id: 10,
          title: "SSC CGL 2026",
          department: "SSC",
          advertisement_no: "CGL-01/2026",
          cycle_year: 2026,
          post_name: "CGL"
        }
      ]
    });
    expect(evaluation.matchLevel).toBe(MATCH_LEVELS.HIGH);
    expect(evaluation.selectedRecruitmentId).toBe(10);
    expect(
      resolvePersistenceDecision({
        eventType: "admit_card",
        matchLevel: evaluation.matchLevel,
        identity: evaluation.identity
      }).decision
    ).toBe(PERSISTENCE_DECISIONS.ATTACH);
  });

  test("E: ambiguous match → Needs Matching", () => {
    const evaluation = evaluateLifecycleMatch({
      notice: {
        title: "SSC JE Admit Card",
        organization: "SSC",
        examName: "JE"
      },
      recruitmentCandidates: [
        { id: 1, title: "SSC JE 2025", department: "SSC", post_name: "JE", cycle_year: 2025 },
        { id: 2, title: "SSC JE 2026", department: "SSC", post_name: "JE", cycle_year: 2026 }
      ]
    });
    expect([MATCH_LEVELS.AMBIGUOUS, MATCH_LEVELS.MEDIUM]).toContain(evaluation.matchLevel);
    expect(
      resolvePersistenceDecision({
        eventType: "admit_card",
        matchLevel: evaluation.matchLevel === MATCH_LEVELS.NO_MATCH ? MATCH_LEVELS.AMBIGUOUS : evaluation.matchLevel,
        identity: evaluation.identity
      }).decision
    ).toBe(PERSISTENCE_DECISIONS.NEEDS_MATCHING);
  });

  test("F: year mismatch is hard negative", () => {
    const evaluation = evaluateLifecycleMatch({
      notice: {
        title: "SSC CGL 2026",
        organization: "SSC",
        examName: "CGL",
        recruitmentYear: 2026
      },
      recruitmentCandidates: [
        {
          id: 10,
          title: "SSC CGL 2025",
          department: "SSC",
          post_name: "CGL",
          cycle_year: 2025
        }
      ]
    });
    expect(evaluation.matchLevel).toBe(MATCH_LEVELS.HARD_NEGATIVE);
  });

  test("G: advertisement number mismatch is hard negative", () => {
    const evaluation = evaluateLifecycleMatch({
      notice: { title: "SSC", advertisementNo: "AAA-1" },
      recruitmentCandidates: [{ id: 1, title: "SSC", advertisement_no: "BBB-2" }]
    });
    expect(evaluation.matchLevel).toBe(MATCH_LEVELS.HARD_NEGATIVE);
  });

  test("M: page-aware HIGH without recruitment_id becomes MEDIUM", () => {
    const evaluation = evaluateLifecycleMatch({
      notice: {
        title: "SSC CGL 2026 Admit Card",
        organization: "SSC",
        advertisementNo: "CGL-01/2026",
        examName: "CGL",
        recruitmentYear: 2026
      },
      pageCandidates: [
        {
          id: 87,
          title: "SSC CGL 2026",
          department: "SSC",
          advertisement_no: "CGL-01/2026",
          post_name: "CGL",
          recruitment_id: null,
          status: "latest job"
        }
      ]
    });
    expect(evaluation.matchLevel).toBe(MATCH_LEVELS.MEDIUM);
    expect(evaluation.selectedRecruitmentId).toBeNull();
  });

  test("O: page snapshot builder preserves recoverable fields", () => {
    const snap = buildPageSnapshot({
      id: 87,
      title: "SSC CGL 2026",
      slug: "ssc-cgl-2026",
      status: "latest job",
      content: "<html>old</html>",
      recruitment_id: 1
    });
    expect(snap.id).toBe(87);
    expect(snap.content).toContain("old");
    expect(snap.recruitment_id).toBe(1);
  });

  test("P/Q: document revision vs duplicate", () => {
    const a = hashDocumentBytes(Buffer.from("%PDF-1.4 same"));
    const b = hashDocumentBytes(Buffer.from("%PDF-1.4 same"));
    const c = hashDocumentBytes(Buffer.from("%PDF-1.4 changed"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(
      evaluateDocumentRevision({
        existingHash: a,
        incomingHash: b,
        existingUpdateId: 100
      }).action
    ).toBe("reuse_duplicate");
    expect(
      evaluateDocumentRevision({
        existingHash: a,
        incomingHash: c,
        existingUpdateId: 100
      }).action
    ).toBe("revision_new_update");
  });

  test("S: advisory CREATE_NEW cannot persist for unknown/downstream", () => {
    expect(guardPersistenceCreateDecision("CREATE_NEW_RECRUITMENT", "unknown").blocked).toBe(true);
    expect(guardPersistenceCreateDecision("CREATE_NEW", "admit_card").blocked).toBe(true);
  });

  test("T: AUTO_PUBLISH remains false; publish policy never auto-publishes", () => {
    expect(getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    for (const type of ["notification", "correction", "admit_card", "answer_key", "result", "unknown"]) {
      expect(resolvePublishPolicy(type).autoPublish).toBe(false);
      expect(resolvePublishPolicy(type).humanChoosesTarget).toBe(true);
    }
    expect(resolvePublishPolicy("admit_card").target).toBe(PUBLISH_TARGETS.DEDICATED_STATUS_PAGE);
    expect(resolvePublishPolicy("correction").target).toBe(PUBLISH_TARGETS.UPDATE_EXISTING_VACANCY_PAGE);
  });

  test("R: same advertisement_no across sources is HIGH identity attach", () => {
    const evaluation = evaluateLifecycleMatch({
      notice: {
        title: "RRB NTPC Admit Card",
        organization: "RRB",
        advertisementNo: "CEN-01/2024"
      },
      recruitmentCandidates: [
        {
          id: 55,
          title: "RRB NTPC",
          department: "RRB",
          advertisement_no: "CEN-01/2024"
        }
      ]
    });
    expect(evaluation.matchLevel).toBe(MATCH_LEVELS.HIGH);
    expect(evaluation.selectedRecruitmentId).toBe(55);
  });
});

describe("needs matching candidate deduplication", () => {
  const {
    normalizeNeedsMatchingCandidates,
    resolveNeedsMatchingCandidates,
    candidateIdentity
  } = require("../server/lib/recruitment/normalizeNeedsMatchingCandidates");

  test("dedupes identical recruitment from needsMatching and processor_output", () => {
    const item = {
      status: "needs_matching",
      payload: {
        needsMatching: {
          candidateRecruitments: [
            {
              kind: "recruitment",
              id: 9,
              recruitmentId: 9,
              title: "SSC JE 2024",
              level: "medium",
              score: 0.62,
              reason: "ambiguous year"
            }
          ]
        }
      },
      processor_output: {
        candidates: [
          {
            kind: "recruitment",
            id: 9,
            recruitmentId: 9,
            title: "SSC JE 2024",
            level: "medium",
            score: 0.62,
            recommendation: "ATTACH_EXISTING_RECRUITMENT"
          }
        ]
      }
    };

    const normalized = resolveNeedsMatchingCandidates(item);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].recruitmentId).toBe(9);
    expect(normalized[0].reason).toBe("ambiguous year");
    expect(normalized[0].recommendation).toBe("ATTACH_EXISTING_RECRUITMENT");
    expect(candidateIdentity(normalized[0])).toBe("recruitment:9");
  });

  test("keeps genuinely different recruitments distinct", () => {
    const normalized = normalizeNeedsMatchingCandidates([
      { kind: "recruitment", id: 1, recruitmentId: 1, title: "JE 2023", score: 0.4 },
      { kind: "recruitment", id: 2, recruitmentId: 2, title: "JE 2024", score: 0.5 },
      { kind: "recruitment", id: 1, recruitmentId: 1, title: "JE 2023", score: 0.55, confidence: "medium" }
    ]);
    expect(normalized).toHaveLength(2);
    const first = normalized.find((c) => c.recruitmentId === 1);
    expect(first.score).toBe(0.55);
    expect(first.confidence).toBe("medium");
  });

  test("merges strongest score/level without discarding metadata", () => {
    const normalized = normalizeNeedsMatchingCandidates([
      {
        kind: "recruitment",
        recruitmentId: 7,
        title: "UPSC",
        level: "low",
        score: 0.2,
        matchLevel: "low",
        reason: "weak title"
      },
      {
        kind: "recruitment",
        id: 7,
        title: "UPSC CSE",
        level: "medium",
        score: 0.7,
        confidence: "medium",
        recommendedAction: "ATTACH_EXISTING_RECRUITMENT"
      }
    ]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].score).toBe(0.7);
    expect(normalized[0].level).toBe("medium");
    expect(normalized[0].reason).toBe("weak title");
    expect(normalized[0].recommendedAction).toBe("ATTACH_EXISTING_RECRUITMENT");
    expect(normalized[0].confidence).toBe("medium");
  });
});
