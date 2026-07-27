"use strict";

const { runRecruitmentPipeline } = require("../server/lib/recruitment/runRecruitmentPipeline");
const { peekRecruitmentCompatibility } = require("../server/lib/recruitment/recruitmentCompatibilityLayer");
const { PROCESS_RESULT_STATUS } = require("../server/lib/recruitment/detectionProcessor");

describe("runRecruitmentPipeline", () => {
  const notice = {
    title: "SSC CGL 2026 Admit Card",
    content: "Download admit card",
    url: "https://ssc.nic.in/admit-card.pdf"
  };

  test("skips when feature flag is disabled", () => {
    const processDetection = jest.fn();
    const result = runRecruitmentPipeline({
      notice,
      isEnabled: false,
      processDetection
    });

    expect(result).toEqual({ skipped: true, reason: "flag_off", updateId: null });
    expect(processDetection).not.toHaveBeenCalled();
  });

  test("invokes detection processor when enabled", () => {
    const processDetection = jest.fn().mockReturnValue({
      status: PROCESS_RESULT_STATUS.SUCCESS,
      warnings: [],
      eventType: "admit_card",
      selectedRecruitment: null,
      reviewItem: { title: notice.title }
    });

    const result = runRecruitmentPipeline({
      notice,
      candidateRecruitments: [],
      isEnabled: true,
      processDetection,
      createdAt: "2026-07-13T12:00:00.000Z"
    });

    expect(processDetection).toHaveBeenCalledWith({
      notice,
      candidateRecruitments: [],
      createdAt: "2026-07-13T12:00:00.000Z"
    });
    expect(result.skipped).toBe(false);
    expect(result.result.eventType).toBe("admit_card");
    expect(result.updateId).toBeNull();
  });

  test("propagates updateId on pipeline outcomes without persistence", () => {
    const processDetection = jest.fn().mockReturnValue({
      status: PROCESS_RESULT_STATUS.NO_MATCH,
      warnings: ["NO_CANDIDATES"],
      eventType: "admit_card",
      selectedRecruitment: null,
      reviewItem: null
    });

    const result = runRecruitmentPipeline({
      notice,
      isEnabled: true,
      processDetection,
      updateId: 555
    });

    expect(result).toEqual({
      skipped: false,
      result: expect.objectContaining({ eventType: "admit_card" }),
      updateId: 555
    });
  });

  test("does not throw when detection processor fails", () => {
    const processDetection = jest.fn(() => {
      throw new Error("detection failed");
    });

    const result = runRecruitmentPipeline({
      notice,
      isEnabled: true,
      processDetection,
      updateId: 12
    });

    expect(result).toEqual({
      skipped: false,
      failed: true,
      error: expect.any(Error),
      updateId: 12
    });
    expect(result.error.message).toBe("detection failed");
  });

  test("never persists review items", () => {
    const processDetection = jest.fn().mockReturnValue({
      status: PROCESS_RESULT_STATUS.SUCCESS,
      warnings: [],
      eventType: "admit_card",
      selectedRecruitment: null,
      reviewItem: {
        title: notice.title,
        eventType: "admit_card",
        status: "pending"
      }
    });

    const result = runRecruitmentPipeline({
      notice,
      isEnabled: true,
      processDetection
    });

    expect(result.result.reviewItem).toBeDefined();
    expect(processDetection).toHaveBeenCalledTimes(1);
  });

  test("attaches recruitment compatibility without changing public return shape", () => {
    const result = runRecruitmentPipeline({
      notice,
      isEnabled: false,
      updateId: 101
    });

    expect(result).toEqual({ skipped: true, reason: "flag_off", updateId: 101 });
    expect(peekRecruitmentCompatibility(result)).not.toBeNull();
    expect(peekRecruitmentCompatibility(result).normalizedUpdate.updateId).toBe(101);
  });
});
