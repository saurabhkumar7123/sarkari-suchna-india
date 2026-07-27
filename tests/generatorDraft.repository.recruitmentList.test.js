"use strict";

jest.mock("../server/config/db", () => ({
  query: jest.fn()
}));

const db = require("../server/config/db");
const generatorDraftRepository = require("../server/repositories/generatorDraft.repository");

describe("generatorDraft.repository listDraftsByRecruitmentId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockImplementation(async (sql) => {
      if (String(sql).includes("information_schema.columns")) {
        return [[{ column_name: "recruitment_id" }, { column_name: "recruitment_event_id" }]];
      }
      if (String(sql).includes("WHERE recruitment_id = ?")) {
        return [
          [
            {
              id: 7,
              title: "Linked draft",
              recruitment_id: 10,
              recruitment_event_id: 1,
              status: "draft"
            }
          ]
        ];
      }
      return [[]];
    });
  });

  test("returns only drafts linked to the recruitment id", async () => {
    const rows = await generatorDraftRepository.listDraftsByRecruitmentId({ recruitment_id: 10 });

    expect(rows).toHaveLength(1);
    expect(rows[0].recruitment_id).toBe(10);
    expect(String(db.query.mock.calls.find((c) => String(c[0]).includes("WHERE recruitment_id"))[0])).toMatch(
      /WHERE recruitment_id = \?/
    );
    expect(
      db.query.mock.calls.find((c) => String(c[0]).includes("WHERE recruitment_id"))[1]
    ).toEqual([10, 30]);
  });

  test("returns empty array for invalid recruitment id", async () => {
    const rows = await generatorDraftRepository.listDraftsByRecruitmentId({ recruitment_id: 0 });
    expect(rows).toEqual([]);
    expect(db.query.mock.calls.some((c) => String(c[0]).includes("WHERE recruitment_id"))).toBe(false);
  });
});
