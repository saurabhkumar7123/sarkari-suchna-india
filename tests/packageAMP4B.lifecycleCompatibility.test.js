"use strict";

/**
 * AMP-4B lifecycle compatibility: event stage → recruitments.lifecycle_state.
 * AUTO_PUBLISH_ENABLED must remain false throughout.
 */

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const fs = require("fs");
const path = require("path");
const db = require("../server/config/db");

const ENTERPRISE_DATA_DIR = path.join(__dirname, "../server/data/enterprise-test-amp4b-lifecycle");

const STAGING_FLAG_KEYS = [
  "RECRUITMENT_PIPELINE_ENABLED",
  "AUTO_DRAFT_ENABLED",
  "AUTO_PUBLISH_ENABLED",
  "TELEGRAM_DELIVERY_ENABLED",
  "LIVE_CRAWLER_ENABLED",
  "NOTIFICATION_GATEWAY_ENABLED",
  "PRODUCTION_MONITORING_ENABLED",
  "SCHEDULER_ACTIVATION_ENABLED",
  "WORKER_ACTIVATION_ENABLED",
  "CRON_ACTIVATION_ENABLED"
];

function clearFlagEnv() {
  for (const key of STAGING_FLAG_KEYS) {
    delete process.env[key];
  }
}

function armRuntimeFlags() {
  process.env.RECRUITMENT_PIPELINE_ENABLED = "true";
  process.env.AUTO_DRAFT_ENABLED = "false";
  process.env.AUTO_PUBLISH_ENABLED = "false";
  process.env.TELEGRAM_DELIVERY_ENABLED = "false";
  process.env.LIVE_CRAWLER_ENABLED = "true";
  process.env.NOTIFICATION_GATEWAY_ENABLED = "false";
  process.env.PRODUCTION_MONITORING_ENABLED = "true";
  process.env.SCHEDULER_ACTIVATION_ENABLED = "false";
  process.env.WORKER_ACTIVATION_ENABLED = "false";
  process.env.CRON_ACTIVATION_ENABLED = "false";
}

beforeAll(() => {
  process.env.ENTERPRISE_DATA_DIR = ENTERPRISE_DATA_DIR;
  if (!fs.existsSync(ENTERPRISE_DATA_DIR)) {
    fs.mkdirSync(ENTERPRISE_DATA_DIR, { recursive: true });
  }
});

afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  clearFlagEnv();
  try {
    require("../server/lib/enterprise/base/schemaGuard").invalidateSchemaCache();
  } catch {
    // ignore
  }
  if (fs.existsSync(ENTERPRISE_DATA_DIR)) {
    for (const file of fs.readdirSync(ENTERPRISE_DATA_DIR)) {
      fs.unlinkSync(path.join(ENTERPRISE_DATA_DIR, file));
    }
  }
});

describe("AMP-4B event stage → recruitment lifecycle mapping", () => {
  test("exam_date maps to exam_scheduled", () => {
    const { mapEventStageToRecruitmentLifecycleState } = require("../server/lib/recruitment/productionRuntime");
    expect(mapEventStageToRecruitmentLifecycleState("exam_date")).toBe("exam_scheduled");
  });

  test("maps other event stages on the same path without silent fallback", () => {
    const { mapEventStageToRecruitmentLifecycleState } = require("../server/lib/recruitment/productionRuntime");
    expect(mapEventStageToRecruitmentLifecycleState("notification")).toBe("announced");
    expect(mapEventStageToRecruitmentLifecycleState("short_notification")).toBe("announced");
    expect(mapEventStageToRecruitmentLifecycleState("correction")).toBe("announced");
    expect(mapEventStageToRecruitmentLifecycleState("city_intimation")).toBe("exam_scheduled");
    expect(mapEventStageToRecruitmentLifecycleState("admit_card")).toBe("exam_scheduled");
    expect(mapEventStageToRecruitmentLifecycleState("answer_key")).toBe("post_exam");
    expect(mapEventStageToRecruitmentLifecycleState("objection")).toBe("post_exam");
    expect(mapEventStageToRecruitmentLifecycleState("result")).toBe("results");
    expect(mapEventStageToRecruitmentLifecycleState("final_result")).toBe("results");
    expect(mapEventStageToRecruitmentLifecycleState("dv")).toBe("results");
    expect(mapEventStageToRecruitmentLifecycleState("joining")).toBe("closed");
    expect(mapEventStageToRecruitmentLifecycleState("vacancy")).toBe("announced");
    expect(mapEventStageToRecruitmentLifecycleState("exam_scheduled")).toBe("exam_scheduled");
    expect(mapEventStageToRecruitmentLifecycleState(null)).toBe("announced");
  });

  test("unknown stages throw Invalid lifecycle_state with no silent fallback", () => {
    const { mapEventStageToRecruitmentLifecycleState } = require("../server/lib/recruitment/productionRuntime");
    expect(() => mapEventStageToRecruitmentLifecycleState("detected")).toThrow("Invalid lifecycle_state");
    expect(() => mapEventStageToRecruitmentLifecycleState("not_a_real_stage")).toThrow("Invalid lifecycle_state");
    expect(() => mapEventStageToRecruitmentLifecycleState("draft")).toThrow("Invalid lifecycle_state");
  });
});

function mockPersistenceAndReview() {
  const createRecruitment = jest.fn().mockImplementation(async (row) => ({
    id: 201,
    ...row
  }));
  jest.doMock("../server/services/enterprise/enterprisePersistence.service", () => ({
    defaultService: {
      recruitment: { upsertExtended: jest.fn().mockResolvedValue({ ok: true }) },
      draft: { upsertExtended: jest.fn().mockResolvedValue({ ok: true }) },
      workflow: {
        getByKey: jest.fn().mockResolvedValue(null),
        createWorkflow: jest.fn().mockResolvedValue({ workflow_key: "wk-exam", current_state: "detected" }),
        updateWorkflow: jest.fn()
      },
      reviewQueue: { upsertExtended: jest.fn().mockResolvedValue({ ok: true }) },
      audit: { recordEvent: jest.fn().mockResolvedValue({ ok: true }) },
      metrics: { upsertMetric: jest.fn().mockResolvedValue({ ok: true }) }
    },
    createEnterprisePersistenceService: jest.fn(),
    getPlatformSnapshot: jest.fn()
  }));
  jest.doMock("../server/services/generatorDraft.service", () => ({
    saveDraft: jest.fn()
  }));
  jest.doMock("../server/services/recruitmentReview.service", () => ({
    saveReviewItem: jest.fn().mockResolvedValue({ id: 88, status: "pending" })
  }));
  jest.doMock("../server/repositories/recruitment.repository", () => ({
    tableExists: jest.fn().mockResolvedValue(true),
    createRecruitment,
    existsBySlug: jest.fn().mockResolvedValue(false)
  }));
  return { createRecruitment };
}

describe("AMP-4B pipeline continues after lifecycle mapping", () => {
  test("Schedule of Examinations does not fabricate a recruitment when none matched", async () => {
    armRuntimeFlags();
    db.query.mockResolvedValue([[]]);
    jest.resetModules();
    const { createRecruitment } = mockPersistenceAndReview();

    const { runProductionDetectionPipeline } = require("../server/lib/recruitment/productionRuntime");
    const flags = require("../server/config/automationFlags");
    const { PUBLISHING_POLICY } = require("../server/lib/productionWorkflow/publishingPolicy");

    const outcome = await runProductionDetectionPipeline({
      notice: {
        title: "Important Notice - Schedule of Examinations",
        content: "Schedule of Examinations for upcoming SSC examinations.",
        url: "https://ssc.gov.in/"
      },
      updateId: 455,
      candidateRecruitments: []
    });

    expect(flags.getAutomationFlags().AUTO_PUBLISH_ENABLED).toBe(false);
    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(PUBLISHING_POLICY.AUTO_PUBLISH_ENABLED).toBe(false);
    expect(outcome.skipped).toBe(false);
    expect(outcome.failed).not.toBe(true);
    expect(outcome.success).toBe(true);
    expect(outcome.publishingBlocked).toBe(true);
    expect(outcome.recruitmentCreated).toBe(false);
    expect(outcome.recruitmentId == null).toBe(true);
    expect(outcome.stage).not.toBe("recruitment_persistence");
    expect(createRecruitment).not.toHaveBeenCalled();
    // AUTO_DRAFT off → no draft → review handoff is intentionally skipped.
    expect(outcome.draft && outcome.draft.skipped).toBe(true);
    expect(outcome.draft && outcome.draft.reason).toBe("auto_draft_disabled");
    expect(outcome.review).toBeNull();
  });

  test("unknown currentStage without a matched recruitment does not fabricate or fail the pipeline", async () => {
    armRuntimeFlags();
    db.query.mockResolvedValue([[]]);
    jest.resetModules();
    const { createRecruitment } = mockPersistenceAndReview();

    jest.doMock("../server/lib/recruitment/runRecruitmentPipeline", () => ({
      runRecruitmentPipeline: jest.fn(() => ({
        skipped: false,
        failed: false,
        updateId: 456,
        result: { eventType: "not_a_real_stage", selectedRecruitment: null }
      }))
    }));
    jest.doMock("../server/lib/recruitment/automationWorkflow", () => {
      const actual = jest.requireActual("../server/lib/recruitment/automationWorkflow");
      return {
        ...actual,
        runProductionAutomationWorkflow: jest.fn(async () => ({
          recruitmentObject: { currentStage: "not_a_real_stage" },
          intelligenceResult: {},
          validation: {},
          historyRecovery: {},
          workflowState: "detected"
        }))
      };
    });

    const { runProductionDetectionPipeline } = require("../server/lib/recruitment/productionRuntime");
    const flags = require("../server/config/automationFlags");

    const outcome = await runProductionDetectionPipeline({
      notice: {
        title: "Important Notice - Schedule of Examinations",
        content: "Schedule of Examinations",
        url: "https://ssc.gov.in/"
      },
      updateId: 456,
      candidateRecruitments: []
    });

    expect(flags.isAutoPublishBlocked()).toBe(true);
    expect(outcome.failed).not.toBe(true);
    expect(outcome.success).toBe(true);
    expect(outcome.recruitmentCreated).toBe(false);
    expect(outcome.recruitmentId == null).toBe(true);
    expect(createRecruitment).not.toHaveBeenCalled();
    expect(outcome.draft && outcome.draft.skipped).toBe(true);
    expect(outcome.review).toBeNull();
  });
});
