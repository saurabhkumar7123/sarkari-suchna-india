"use strict";

const { processJobParse } = require("../server/services/aiParseJob.service");
const { buildDynamicSectionsWithWarnings } = require("../generator/builders/sectionBuilder");

const USER_SAMPLE = `[section: Short Information]
Uttar Pradesh Public Service Commission  [section: Important Dates]
Online Apply Start Date : 04 September 2025 [section: APPLICATION Fee]
For General / OBC / EWS : ₹ 125/-`;

const RAW_WITH_LINKS = `UPSC Civil Services Examination 2025
Online Apply Start Date : 04 September 2025
Last Date : 30 September 2025
For General / OBC / EWS : Rs 125/-
Apply Online https://upsc.gov.in
Post, Category, Vacancy
IAS, General, 200
IFS, OBC, 50`;

const RAW_NO_SECTIONS = `Uttar Pradesh Public Service Commission
Online Apply Start Date : 04 September 2025
Last Date : 30 September 2025
For General / OBC / EWS : Rs 125/-
Apply Online https://uppsc.up.nic.in`;

const PLAIN_HEADINGS = `Short Information
Uttar Pradesh Public Service Commission Lower PCS 2026
Important Dates
Online Apply Start Date : 04 September 2025
Application Fee
For General / OBC / EWS : Rs 125/-`;

describe("ai-parse publisher sections", () => {
  test("preserves user structured sample on Convert with AI", async () => {
    const { result } = await processJobParse(USER_SAMPLE);
    expect(result).toContain("[Section: Short Information]");
    expect(result).toContain("Uttar Pradesh Public Service Commission");
    expect(result).toContain("[Section: Important Dates]");
    expect(result).toContain("Online Apply Start Date : 04 September 2025");
    expect(result).toContain("[Section: Application Fee]");
    expect(result).toContain("For General / OBC / EWS : ₹ 125/-");
    expect(result).not.toMatch(/\[Section: Vacancy\][\s\S]*For General \/ OBC/);
  });

  test("raw text maps fee, dates, links, and vacancy table", async () => {
    const { result } = await processJobParse(RAW_WITH_LINKS);
    expect(result).toMatch(/\[Section: Short Information\]/i);
    expect(result).toMatch(/\[Section: Important Dates\]/i);
    expect(result).toMatch(/\[Section: Application Fee\]/i);
    expect(result).toMatch(/\[Section: Important Links\]/i);
    expect(result).toMatch(/upsc\.gov\.in/i);
    expect(result).toMatch(/\[Section: Vacancy \| table\]/i);
    const built = buildDynamicSectionsWithWarnings(result);
    expect(built.html).toContain("<table");
  });

  test("raw data without [section:] markers auto-builds sections", async () => {
    const { result } = await processJobParse(RAW_NO_SECTIONS);
    expect(result).toContain("Uttar Pradesh Public Service Commission");
    expect(result).toContain("Online Apply Start Date : 04 September 2025");
    expect(result).toContain("For General / OBC / EWS : Rs 125/-");
    expect(result).toContain("Apply Online=https://uppsc.up.nic.in");
    expect(result).not.toContain("[Section: Eligibility]");
    expect(result).not.toContain("[Section: Vacancy]");
  });

  test("plain PDF headings without brackets become sections", async () => {
    const { result } = await processJobParse(PLAIN_HEADINGS);
    expect(result).toContain("[Section: Short Information]");
    expect(result).toContain("Lower PCS 2026");
    expect(result).toContain("[Section: Important Dates]");
    expect(result).toContain("[Section: Application Fee]");
    expect(result).toContain("For General / OBC / EWS : Rs 125/-");
  });

  test("FAQ preserves user language in Important Questions section", async () => {
    const raw = `UPSC 2025
Q: What is the last date to apply?
A: 30 September 2025
Q: आयु सीमा क्या है?
A: 21-32 years`;
    const { result } = await processJobParse(raw);
    expect(result).toContain("[Section: Important Questions]");
    expect(result).toContain("Q: What is the last date to apply?");
    expect(result).toContain("A: 30 September 2025");
    expect(result).toContain("Q: आयु सीमा क्या है?");
    expect(result).not.toContain("आवेदन की अंतिम तिथि");
  });
});
