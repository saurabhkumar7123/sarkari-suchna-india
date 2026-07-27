"use strict";

const { EVENT_TYPES } = require("../server/services/recruitmentEvent.service");
const {
  LIFECYCLE_EVENT_TYPES,
  CONFIDENCE_LEVELS,
  UNKNOWN_EVENT_TYPE,
  normalizeRecruitmentNoticeText,
  classifyRecruitmentEventType
} = require("../server/lib/recruitment/eventTypeClassifier");

describe("eventTypeClassifier", () => {
  test("LIFECYCLE_EVENT_TYPES matches recruitmentEvent.service EVENT_TYPES", () => {
    expect([...LIFECYCLE_EVENT_TYPES]).toEqual([...EVENT_TYPES]);
  });

  describe("normalizeRecruitmentNoticeText", () => {
    test("lowercases and collapses whitespace", () => {
      expect(normalizeRecruitmentNoticeText({ title: "  SSC   CGL   RESULT  " })).toBe("ssc cgl result");
    });

    test("normalizes punctuation to spaces", () => {
      expect(normalizeRecruitmentNoticeText({ title: "Admit-Card!!! (Tier-1)" })).toBe(
        "admit card tier 1"
      );
    });

    test("expands common abbreviations", () => {
      expect(normalizeRecruitmentNoticeText({ title: "Advt. No. 01/2026" })).toContain("advertisement");
      expect(normalizeRecruitmentNoticeText({ title: "AC download link" })).toContain("admit card");
    });

    test("includes optional content and url path segments", () => {
      const text = normalizeRecruitmentNoticeText({
        title: "Notice",
        content: "Answer Key published",
        url: "https://ssc.nic.in/answer-key-2026.pdf"
      });
      expect(text).toContain("notice");
      expect(text).toContain("answer key");
      expect(text).toContain("answer key 2026 pdf");
    });
  });

  describe("classifyRecruitmentEventType — lifecycle types", () => {
    const cases = [
      ["notification", "SSC CGL 2026 Recruitment Notification", "high"],
      ["notification", "Detailed Advertisement for 500 Posts", "high"],
      ["short_notification", "Short Notification for JE Posts", "high"],
      ["correction", "Corrigendum to Notification No. 03/2026", "high"],
      ["correction", "Errata in Advertisement", "high"],
      ["exam_date", "Exam Date for Tier-II Examination", "high"],
      ["exam_date", "Schedule of Examination", "high"],
      ["city_intimation", "Exam City Intimation Slip", "high"],
      ["admit_card", "Download Admit Card for CGL Tier-1", "high"],
      ["admit_card", "Hall Ticket available now", "high"],
      ["answer_key", "Provisional Answer Key Released", "high"],
      ["objection", "Objection window open for candidates", "high"],
      ["result", "Result declared for Tier 1", "high"],
      ["final_result", "Final Result and Merit List", "high"],
      ["dv", "Document Verification schedule", "high"],
      ["medical", "Medical Examination of selected candidates", "high"],
      ["joining", "Joining Letter for appointed candidates", "high"]
    ];

    test.each(cases)("classifies %s from %s", (eventType, title, confidence) => {
      const result = classifyRecruitmentEventType({ title });
      expect(result.eventType).toBe(eventType);
      expect(result.confidence).toBe(confidence);
      expect(result.matchedRules.length).toBeGreaterThan(0);
      expect(result.normalizedText.length).toBeGreaterThan(0);
    });
  });

  test("is case-insensitive", () => {
    const lower = classifyRecruitmentEventType({ title: "admit card download" });
    const upper = classifyRecruitmentEventType({ title: "ADMIT CARD DOWNLOAD" });
    expect(lower.eventType).toBe("admit_card");
    expect(upper.eventType).toBe("admit_card");
  });

  test("prefers final_result over generic result", () => {
    const result = classifyRecruitmentEventType({ title: "Final Result declared" });
    expect(result.eventType).toBe("final_result");
    expect(result.matchedRules).toContain("final-result-explicit");
  });

  test("prefers correction over notification when corrigendum present", () => {
    const result = classifyRecruitmentEventType({
      title: "Corrigendum to Recruitment Notification"
    });
    expect(result.eventType).toBe("correction");
  });

  test("prefers short_notification over notification", () => {
    const result = classifyRecruitmentEventType({ title: "Short Notification for Group D" });
    expect(result.eventType).toBe("short_notification");
  });

  test("returns unknown for unrelated titles without guessing", () => {
    const result = classifyRecruitmentEventType({ title: "Office Holiday List 2026" });
    expect(result.eventType).toBe(UNKNOWN_EVENT_TYPE);
    expect(result.confidence).toBe("none");
    expect(result.matchedRules).toEqual([]);
  });

  test("returns unknown for empty input", () => {
    const result = classifyRecruitmentEventType({});
    expect(result.eventType).toBe(UNKNOWN_EVENT_TYPE);
    expect(result.confidence).toBe("none");
    expect(result.matchedRules).toEqual([]);
    expect(result.normalizedText).toBe("");
  });

  test("lowers confidence on ambiguous multi-type titles", () => {
    const result = classifyRecruitmentEventType({
      title: "Result and Answer Key notice"
    });
    expect(["answer_key", "result"]).toContain(result.eventType);
    expect(["medium", "low"]).toContain(result.confidence);
    expect(result.matchedRules.length).toBeGreaterThan(0);
  });

  test("uses content when title is weak", () => {
    const result = classifyRecruitmentEventType({
      title: "Update",
      content: "Document verification for shortlisted candidates on 12 July"
    });
    expect(result.eventType).toBe("dv");
  });

  test("uses url path hints when title is generic", () => {
    const result = classifyRecruitmentEventType({
      title: "SSC update",
      url: "https://ssc.nic.in/admit-card-tier1.html"
    });
    expect(result.eventType).toBe("admit_card");
  });

  test("confidence levels are from the allowed set", () => {
    const samples = [
      { title: "Admit Card" },
      { title: "Vacancy form" },
      { title: "Random syllabus topic" }
    ];
    for (const sample of samples) {
      const result = classifyRecruitmentEventType(sample);
      expect(CONFIDENCE_LEVELS).toContain(result.confidence);
    }
  });

  describe("regression cases", () => {
    test("provisional result stays result not final_result", () => {
      const result = classifyRecruitmentEventType({ title: "Provisional Result Tier 1" });
      expect(result.eventType).toBe("result");
    });

    test("revised notification maps to correction", () => {
      const result = classifyRecruitmentEventType({ title: "Revised Notification No. 2/2026" });
      expect(result.eventType).toBe("correction");
    });

    test("exam city intimation beats generic schedule-only medium rule when explicit", () => {
      const result = classifyRecruitmentEventType({ title: "Exam City Intimation for CGL" });
      expect(result.eventType).toBe("city_intimation");
      expect(result.confidence).toBe("high");
    });

    test("deterministic output for same input", () => {
      const input = { title: "  FINAL   RESULT!!! ", content: "Merit list" };
      const a = classifyRecruitmentEventType(input);
      const b = classifyRecruitmentEventType(input);
      expect(a).toEqual(b);
    });
  });
});
