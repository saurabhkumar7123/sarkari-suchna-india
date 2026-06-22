"use strict";

const {
  pageContentFieldsChanged,
  CONTENT_FRESHNESS_FIELD_KEYS
} = require("../server/lib/contentFreshness");

describe("contentFreshness", () => {
  const baseRow = {
    title: "SSC CGL Notification",
    status: "latest job",
    category: "latest-job",
    qualification: "graduate",
    state: "all india",
    department: "ssc",
    post_name: "Assistant",
    total_posts: "1000",
    last_date: "2026-07-01",
    content: "<p>Hello</p>",
    raw_text: "Hello"
  };

  test("CONTENT_FRESHNESS_FIELD_KEYS excludes placement fields", () => {
    expect(CONTENT_FRESHNESS_FIELD_KEYS).not.toContain("breaking");
    expect(CONTENT_FRESHNESS_FIELD_KEYS).not.toContain("badges");
    expect(CONTENT_FRESHNESS_FIELD_KEYS).not.toContain("event_time");
  });

  test("returns false when only breaking-related params differ conceptually", () => {
    const incoming = {
      ...baseRow,
      title: baseRow.title,
      normalizedStatus: baseRow.status,
      finalHTML: baseRow.content,
      text: baseRow.raw_text,
      postName: baseRow.post_name,
      totalPosts: baseRow.total_posts,
      lastDate: baseRow.last_date
    };
    expect(pageContentFieldsChanged(baseRow, incoming)).toBe(false);
  });

  test("returns true when title changes", () => {
    expect(
      pageContentFieldsChanged(baseRow, {
        title: "Updated Title",
        normalizedStatus: baseRow.status,
        category: baseRow.category,
        qualification: baseRow.qualification,
        state: baseRow.state,
        department: baseRow.department,
        postName: baseRow.post_name,
        totalPosts: baseRow.total_posts,
        lastDate: baseRow.last_date,
        finalHTML: baseRow.content,
        text: baseRow.raw_text
      })
    ).toBe(true);
  });

  test("returns false when event_time would change but content fields identical", () => {
    expect(
      pageContentFieldsChanged(baseRow, {
        title: baseRow.title,
        normalizedStatus: baseRow.status,
        category: baseRow.category,
        qualification: baseRow.qualification,
        state: baseRow.state,
        department: baseRow.department,
        postName: baseRow.post_name,
        totalPosts: baseRow.total_posts,
        lastDate: baseRow.last_date,
        finalHTML: baseRow.content,
        text: baseRow.raw_text,
        eventTime: "2026-08-01T10:00"
      })
    ).toBe(false);
  });
});
