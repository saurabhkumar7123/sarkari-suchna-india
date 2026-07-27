"use strict";

jest.mock("../server/config/db", () => ({
  query: jest.fn(),
  getConnection: jest.fn()
}));

const db = require("../server/config/db");
const {
  fetchRecentUpdates,
  insertDetectedUpdate,
  saveDetectedUpdate,
  mapLegacyUpdateRow,
  mapRecruitmentAwareUpdateRow,
  linkageColumnsExist
} = require("../server/services/updates/updates.repository");

describe("updates read awareness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("mapLegacyUpdateRow preserves legacy detection fields only", () => {
    expect(
      mapLegacyUpdateRow({
        id: 7,
        siteId: 3,
        siteName: "SSC",
        title: "Notice",
        link: "https://example.com",
        createdAt: "2026-07-13T00:00:00.000Z",
        recruitmentId: 10
      })
    ).toEqual({
      id: 7,
      siteId: 3,
      siteName: "SSC",
      title: "Notice",
      link: "https://example.com",
      createdAt: "2026-07-13T00:00:00.000Z"
    });
  });

  test("mapRecruitmentAwareUpdateRow includes linkage only when present", () => {
    expect(
      mapRecruitmentAwareUpdateRow({
        id: 7,
        siteId: 3,
        siteName: "SSC",
        title: "Notice",
        link: "https://example.com",
        createdAt: "2026-07-13T00:00:00.000Z",
        recruitmentId: null,
        recruitmentEventId: null
      })
    ).toEqual({
      id: 7,
      siteId: 3,
      siteName: "SSC",
      title: "Notice",
      link: "https://example.com",
      createdAt: "2026-07-13T00:00:00.000Z",
      recruitment_id: null,
      recruitment_event_id: null
    });

    expect(
      mapRecruitmentAwareUpdateRow({
        id: 8,
        siteId: 3,
        siteName: "SSC",
        title: "Admit card",
        link: null,
        createdAt: "2026-07-13T01:00:00.000Z",
        recruitmentId: 10,
        recruitmentEventId: 5,
        recruitmentTitle: "SSC CGL 2026",
        recruitmentSlug: "ssc-cgl-2026",
        recruitmentLifecycleState: "open",
        recruitmentEventType: "admit_card",
        recruitmentEventSequenceOrder: 2,
        recruitmentEventStatus: "active"
      })
    ).toEqual({
      id: 8,
      siteId: 3,
      siteName: "SSC",
      title: "Admit card",
      link: null,
      createdAt: "2026-07-13T01:00:00.000Z",
      recruitment_id: 10,
      recruitment_event_id: 5,
      recruitment: {
        id: 10,
        title: "SSC CGL 2026",
        slug: "ssc-cgl-2026",
        lifecycle_state: "open"
      },
      recruitment_event: {
        id: 5,
        event_type: "admit_card",
        sequence_order: 2,
        status: "active"
      }
    });
  });

  test("fetchRecentUpdates uses legacy query when read awareness is off", async () => {
    db.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          siteId: 2,
          siteName: "UPSC",
          title: "Notification",
          link: "https://upsc.gov.in",
          createdAt: "2026-07-13T00:00:00.000Z"
        }
      ]
    ]);

    const rows = await fetchRecentUpdates(20, { includeRecruitmentLinkage: false });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(String(db.query.mock.calls[0][0])).not.toMatch(/recruitment_id/);
    expect(rows).toEqual([
      {
        id: 1,
        siteId: 2,
        siteName: "UPSC",
        title: "Notification",
        link: "https://upsc.gov.in",
        createdAt: "2026-07-13T00:00:00.000Z"
      }
    ]);
  });

  test("fetchRecentUpdates tolerates NULL linkage when read awareness is on", async () => {
    db.query
      .mockResolvedValueOnce([[{ column_name: "recruitment_id" }, { column_name: "recruitment_event_id" }]])
      .mockResolvedValueOnce([
        [
          {
            id: 1,
            siteId: 2,
            siteName: "UPSC",
            title: "Notification",
            link: "https://upsc.gov.in",
            createdAt: "2026-07-13T00:00:00.000Z",
            recruitmentId: null,
            recruitmentEventId: null,
            recruitmentTitle: null,
            recruitmentSlug: null,
            recruitmentLifecycleState: null,
            recruitmentEventType: null,
            recruitmentEventSequenceOrder: null,
            recruitmentEventStatus: null
          }
        ]
      ]);

    const rows = await fetchRecentUpdates(20, { includeRecruitmentLinkage: true });

    expect(String(db.query.mock.calls[1][0])).toMatch(/LEFT JOIN recruitments/);
    expect(rows[0]).toEqual({
      id: 1,
      siteId: 2,
      siteName: "UPSC",
      title: "Notification",
      link: "https://upsc.gov.in",
      createdAt: "2026-07-13T00:00:00.000Z",
      recruitment_id: null,
      recruitment_event_id: null
    });
  });

  test("fetchRecentUpdates falls back to legacy query when linkage columns are missing", async () => {
    db.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        [
          {
            id: 3,
            siteId: 1,
            siteName: "SSC",
            title: "Result",
            link: null,
            createdAt: "2026-07-13T02:00:00.000Z"
          }
        ]
      ]);

    const rows = await fetchRecentUpdates(10, { includeRecruitmentLinkage: true });

    expect(String(db.query.mock.calls[1][0])).not.toMatch(/recruitment_id/);
    expect(rows[0]).not.toHaveProperty("recruitment_id");
  });

  test("insertDetectedUpdate write query is unchanged", async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await insertDetectedUpdate({
      siteId: 4,
      title: "New notice",
      link: "https://example.com/new"
    });

    expect(db.query).toHaveBeenCalledWith(
      "INSERT INTO updates (site_id, title, link) VALUES (?, ?, ?)",
      [4, "New notice", "https://example.com/new"]
    );
  });

  test("saveDetectedUpdate write query is unchanged", async () => {
    const conn = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([{ affectedRows: 1 }])
    };
    db.getConnection = jest.fn().mockResolvedValue(conn);

    await saveDetectedUpdate({
      siteId: 4,
      title: "New notice",
      link: "https://example.com/new",
      latestContent: "baseline"
    });

    expect(conn.query).toHaveBeenCalledWith(
      "INSERT INTO updates (site_id, title, link) VALUES (?, ?, ?)",
      [4, "New notice", "https://example.com/new"]
    );
  });

  test("linkageColumnsExist checks updates linkage columns", async () => {
    db.query.mockResolvedValueOnce([[{ column_name: "recruitment_id" }, { column_name: "recruitment_event_id" }]]);

    await expect(linkageColumnsExist()).resolves.toBe(true);
    expect(String(db.query.mock.calls[0][0])).toMatch(/table_name = 'updates'/);
  });
});
