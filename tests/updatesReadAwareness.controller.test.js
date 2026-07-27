"use strict";

jest.mock("../server/services/updates/updates.repository", () => ({
  fetchSites: jest.fn(),
  createSite: jest.fn(),
  getSiteById: jest.fn(),
  updateSite: jest.fn(),
  deleteSite: jest.fn(),
  fetchRecentUpdates: jest.fn(),
  restoreSite: jest.fn(),
  disableSite: jest.fn()
}));

jest.mock("../server/config/recruitmentLifecycle", () => ({
  isRecruitmentReadAwarenessEnabled: jest.fn()
}));

jest.mock("../server/services/updates/updateScheduler", () => ({
  triggerManualUpdateCheck: jest.fn()
}));

jest.mock("../server/services/updates/telegramNotifier", () => ({
  sendTelegramMessage: jest.fn(),
  canSendTelegram: jest.fn().mockReturnValue(false)
}));

jest.mock("../server/services/queue/siteQueue", () => ({
  siteCheckQueue: {
    getJobCounts: jest.fn(),
    getJobs: jest.fn(),
    drain: jest.fn(),
    clean: jest.fn()
  }
}));

jest.mock("../server/config/redis", () => ({
  isOpen: false
}));

jest.mock("../server/services/updates/schedulerLeadership", () => ({
  isCurrentNodeSchedulerLeader: jest.fn(),
  getCurrentSchedulerLockOwner: jest.fn()
}));

jest.mock("../server/services/adminActivity.service", () => ({
  recordActivity: jest.fn().mockResolvedValue(undefined)
}));

const { fetchRecentUpdates } = require("../server/services/updates/updates.repository");
const { isRecruitmentReadAwarenessEnabled } = require("../server/config/recruitmentLifecycle");
const { listRecentUpdates } = require("../server/controllers/admin/updates.controller");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("updates.controller listRecentUpdates read awareness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchRecentUpdates.mockResolvedValue([{ id: 1, siteId: 2, siteName: "SSC", title: "Notice" }]);
  });

  test("passes includeRecruitmentLinkage false when feature flag is off", async () => {
    isRecruitmentReadAwarenessEnabled.mockReturnValue(false);
    const req = { query: { limit: "25" } };
    const res = mockRes();

    await listRecentUpdates(req, res, jest.fn());

    expect(fetchRecentUpdates).toHaveBeenCalledWith(25, { includeRecruitmentLinkage: false });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 1, siteId: 2, siteName: "SSC", title: "Notice" }]
    });
  });

  test("passes includeRecruitmentLinkage true when feature flag is on", async () => {
    isRecruitmentReadAwarenessEnabled.mockReturnValue(true);
    const req = { query: {} };
    const res = mockRes();

    await listRecentUpdates(req, res, jest.fn());

    expect(fetchRecentUpdates).toHaveBeenCalledWith(50, { includeRecruitmentLinkage: true });
  });
});
