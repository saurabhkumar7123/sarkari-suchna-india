"use strict";

/**
 * Phase 31.C — Runtime candidate lookup (read-only) regression.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

jest.mock("../server/repositories/recruitment.repository", () => ({
  tableExists: jest.fn(),
  findCandidatesForLookup: jest.fn(),
  findCandidatesByAdvertisementNoLoose: jest.fn()
}));

const recruitmentRepository = require("../server/repositories/recruitment.repository");
const {
  hasSufficientLookupCriteria,
  lookupRecruitmentCandidatesForRuntime,
  LOOKUP_EXECUTION_STATUS
} = require("../server/services/recruitmentCandidateLookup.service");
const {
  resetRuntimePreviewBuffer,
  recordRuntimePreviewFromPipeline,
  listRuntimePreviews
} = require("../server/lib/recruitment/runtimePreviewBuffer");

describe("Phase 31.C — lookup criteria gate", () => {
  test("hasSufficientLookupCriteria is true for org+exam notices", () => {
    expect(
      hasSufficientLookupCriteria({ title: "SSC CGL 2026 Admit Card" })
    ).toBe(true);
  });

  test("hasSufficientLookupCriteria is false for weak notices", () => {
    expect(hasSufficientLookupCriteria({ title: "New update" })).toBe(false);
    expect(hasSufficientLookupCriteria({ title: "", content: "", url: "" })).toBe(false);
  });
});

describe("Phase 31.C — lookupRecruitmentCandidatesForRuntime", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    recruitmentRepository.tableExists.mockResolvedValue(true);
    recruitmentRepository.findCandidatesForLookup.mockResolvedValue([]);
    recruitmentRepository.findCandidatesByAdvertisementNoLoose.mockResolvedValue([]);
  });

  test("skips DB when criteria are insufficient", async () => {
    const result = await lookupRecruitmentCandidatesForRuntime({
      notice: { title: "Hello world", content: "Hello world", url: "" }
    });

    expect(result.candidates).toEqual([]);
    expect(result.lookupSummary.status).toBe(LOOKUP_EXECUTION_STATUS.SKIPPED);
    expect(result.lookupSummary.strategy).toBe("insufficient_criteria");
    expect(recruitmentRepository.tableExists).not.toHaveBeenCalled();
    expect(recruitmentRepository.findCandidatesForLookup).not.toHaveBeenCalled();
  });

  test("returns candidates and ok summary when lookup succeeds", async () => {
    recruitmentRepository.findCandidatesForLookup.mockResolvedValueOnce([
      {
        id: 5,
        title: "SSC CGL 2026",
        slug: "ssc-cgl-2026",
        department: "ssc",
        post_name: "Combined Graduate Level",
        advertisement_no: "CGL-01/2026",
        cycle_year: 2026
      }
    ]);

    const result = await lookupRecruitmentCandidatesForRuntime({
      notice: { title: "SSC Admit Card Advt No CGL-01/2026" }
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.lookupSummary.status).toBe(LOOKUP_EXECUTION_STATUS.OK);
    expect(result.lookupSummary.strategy).toBe("advertisement_number_exact");
    expect(result.lookupSummary.candidateCount).toBe(1);
    expect(recruitmentRepository.findCandidatesForLookup).toHaveBeenCalled();
  });

  test("isolates lookup failures without throwing", async () => {
    recruitmentRepository.tableExists.mockRejectedValue(new Error("connection lost"));

    const result = await lookupRecruitmentCandidatesForRuntime({
      notice: { title: "SSC CGL 2026 Admit Card" }
    });

    expect(result.candidates).toEqual([]);
    expect(result.lookupSummary.status).toBe(LOOKUP_EXECUTION_STATUS.FAILED);
    expect(result.lookupSummary.strategy).toBe("lookup_error");
    expect(result.lookupSummary.message).toMatch(/connection lost/);
  });
});

describe("Phase 31.C — preview lookup summary", () => {
  beforeEach(() => {
    resetRuntimePreviewBuffer();
  });

  test("preview entry stores lookup summary fields", () => {
    recordRuntimePreviewFromPipeline({
      pipelineOutcome: {
        skipped: false,
        result: {
          status: "no_match",
          warnings: ["NO_CANDIDATES"],
          eventType: "admit_card",
          selectedRecruitment: null,
          reviewItem: null
        },
        updateId: 10
      },
      notice: { title: "SSC CGL", content: "SSC CGL", url: "" },
      updateId: 10,
      lookupSummary: {
        status: "ok",
        strategy: "organization_exam",
        candidateCount: 2,
        limitedTo: 20,
        criteria: { organization: "ssc", examName: "cgl" }
      }
    });

    const listed = listRuntimePreviews({});
    expect(listed.data[0].lookupSummary).toEqual(
      expect.objectContaining({
        status: "ok",
        strategy: "organization_exam",
        candidateCount: 2
      })
    );
  });
});

describe("Phase 31.C — no persistence / source regression", () => {
  test("worker uses read-only lookup and never saves reviews", () => {
    const worker = read("server/services/workers/siteWorker.js");
    expect(worker).toMatch(/lookupRecruitmentCandidatesForRuntime/);
    expect(worker).not.toMatch(/saveReviewItem/);
    expect(worker).not.toMatch(/recruitmentReview\.service/);
    expect(worker).not.toMatch(/recruitment_review_queue/);
  });

  test("runtime lookup helper never writes", () => {
    const source = read("server/services/recruitmentCandidateLookup.service.js");
    expect(source).toMatch(/lookupRecruitmentCandidatesForRuntime/);
    expect(source).not.toMatch(/INSERT INTO|UPDATE |DELETE FROM|saveReviewItem/i);
  });

  test("monitoring and scheduler remain free of lookup wiring", () => {
    const siteChecker = read("server/services/updates/siteChecker.js");
    expect(siteChecker).not.toMatch(/lookupRecruitmentCandidates/);
    expect(siteChecker).not.toMatch(/runRecruitmentPipeline/);
  });
});
