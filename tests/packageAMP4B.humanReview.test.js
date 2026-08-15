"use strict";

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const {
  buildBoundReviewItem,
  formatTelegramReviewMessage
} = require("../server/lib/recruitment/productionRuntime");
const { PUBLISHING_POLICY, evaluateManualPublishGate } = require("../server/lib/productionWorkflow/publishingPolicy");
const flags = require("../server/config/automationFlags");

describe("AMP-4B human review binding and Telegram formatting", () => {
  test("review item keeps detection fields and binds recruitmentId", () => {
    const reviewItem = buildBoundReviewItem({
      detection: {
        eventType: "exam_date",
        reviewItem: {
          eventType: "exam_date",
          title: "Important Notice - Schedule of Examinations",
          matchResult: "new"
        }
      },
      workflowResult: { intelligenceResult: { confidence: { level: "high" } } },
      recruitmentId: 1,
      notice: { title: "Important Notice - Schedule of Examinations", url: "https://ssc.gov.in/" }
    });
    expect(reviewItem.recruitmentId).toBe(1);
    expect(reviewItem.eventType).toBe("exam_date");
    expect(reviewItem.title).toContain("Schedule of Examinations");
    expect(reviewItem.matchResult).not.toBe("new");
    expect(reviewItem.matchResult).not.toBe("matched");
  });

  test("Telegram uses human-readable text, not object serialization", () => {
    const message = formatTelegramReviewMessage({
      workflowResult: {
        telegramReview: {
          text: "Automation Workflow Review\nRecruitment: SSC notice",
          message: { recruitment: "SSC notice", recruitmentId: "UNASSIGNED_RECRUITMENT" }
        },
        recruitmentObject: { recruitmentName: "SSC notice" }
      },
      notice: { title: "Important Notice - Schedule of Examinations" },
      recruitmentId: 1,
      draftId: 10,
      reviewId: 1
    });
    expect(message).not.toMatch(/\[object Object\]/);
    expect(typeof message).toBe("string");
    expect(message).toContain("Automation Workflow Review");
    expect(message).toContain("Draft id: 10");
    expect(message).toContain("Review item id: 1");
    expect(message).toContain("Recruitment id: 1");
    expect(message).toContain("AUTO_PUBLISH remains disabled.");
  });

  test("AUTO_PUBLISH remains blocked and manual publish stays unconfirmed", () => {
    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
    const gate = evaluateManualPublishGate({ confirmManualPublish: false, readyForReview: true });
    expect(gate.published).toBe(false);
    expect(gate.allowed).toBe(false);
  });
});
