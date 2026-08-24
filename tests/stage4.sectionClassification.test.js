"use strict";

/**
 * Stage 4 — targeted section-classification regressions.
 * Covers date pollution, departmental exam notices, ordinal dates,
 * eligibility safety, and official link labels. Does not enable AUTO_DRAFT.
 */

const {
  classifyLine,
  looksLikeVacancyOrAllocationRow
} = require("../server/utils/sectionDetector");
const {
  isMilestoneEventDateLine,
  isAllocationTableDateRow,
  extractDateValueForDisplay
} = require("../server/utils/extractDateValue");
const {
  joinSplitOrdinalDates,
  advancedNormalize
} = require("../server/lib/generatorIntelligence/textNormalization");
const {
  runGeneratorIntelligencePipeline,
  detectByLineClassification,
  parseLinkLine,
  detectAndClassifyLinks,
  classifyTableKind,
  pickPrimaryVacancyTable,
  detectSmartTables
} = require("../server/lib/generatorIntelligence");
const { SAMPLES } = require("./fixtures/ai1/notificationSamples");

function withoutOpenAi(fn) {
  return async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await fn();
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  };
}

function sectionBody(publisher, title) {
  const escaped = String(title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `\\[Section:\\s*${escaped}(?:\\s*\\|\\s*table)?\\]([\\s\\S]*?)(?=\\n\\[Section:|$)`,
    "i"
  );
  const m = String(publisher || "").match(re);
  return m ? m[1].trim() : "";
}

describe("Stage 4 TEST A — date pollution", () => {
  const mixed = `Staff Selection Commission
Combined Higher Secondary Level Examination 2025
First Round of Tentative Allocation notice.
The result of Tier-I was declared on 27.02.2026 for shortlisting candidates.
Tier-II was held on 10.04.2026 and 22.04.2026.
Option-cum-preference has been taken online from 19.06.2026 to 25.06.2026.
Sliding process from 20th August 2026 to 22nd August 2026.
Date of Birth of last selected candidates is shown below.
D54 UR 6 5 211 119 171.67478 30-12-2002
D55 SC 2 2 302 165 162.76057 24-08-2004
Official Website https://ssc.gov.in/`;

  test("candidate DOBs and allocation rows are not event dates", () => {
    expect(isAllocationTableDateRow("D54 UR 6 5 211 119 171.67478 30-12-2002")).toBe(true);
    expect(isMilestoneEventDateLine("D54 UR 6 5 211 119 171.67478 30-12-2002")).toBe(false);
    expect(classifyLine("D54 UR 6 5 211 119 171.67478 30-12-2002")).toBe("vacancy");
    expect(extractDateValueForDisplay("D54 UR 6 5 211 119 171.67478 30-12-2002")).toBe("—");
    expect(isMilestoneEventDateLine("The result of Tier-I was declared on 27.02.2026")).toBe(true);
    expect(isMilestoneEventDateLine("Sliding process from 20th August 2026 to 22nd August 2026")).toBe(true);
  });

  test("pipeline keeps event dates and drops DOBs from Important Dates", () => {
    const { result, structured } = runGeneratorIntelligencePipeline(mixed);
    const dates = sectionBody(result, "Important Dates");
    expect(dates).toMatch(/27\.02\.2026|27 February 2026/i);
    expect(dates).toMatch(/10\.04\.2026|10 April 2026|22\.04\.2026|22 April 2026/i);
    expect(dates).toMatch(/19\.06\.2026|19 June 2026|20th August 2026|20 August 2026/i);
    expect(dates).not.toMatch(/30-12-2002|30 December 2002/);
    expect(dates).not.toMatch(/24-08-2004|24 August 2004/);
    const dateSection = (structured.sections || []).find((s) => s.sectionType === "important_dates");
    const dateText = JSON.stringify(dateSection || {});
    expect(dateText).not.toMatch(/30-12-2002/);
    expect(dateText).not.toMatch(/24-08-2004/);
  });
});

describe("Stage 4 TEST B — departmental exam notice is not vacancy", () => {
  const sitting = `Staff Selection Commission (NR)
IMPORTANT NOTICE
The Commission has decided to conduct following examinations at Delhi on 23
rd
August,
2026.
S. | Name of Examination
1. Assistant Section Officer / Assistant Grade Limited Departmental Competitive Examination, 2025
2. Senior Secretariat Assistant / Upper Division Clerk Grade Limited Departmental Competitive Examination, 2025
3. Junior Secretariat Assistant / Lower Division Clerk Grade Limited Departmental Competitive Examination, 2025
The candidates are advised to visit the website of the Commission at regular intervals for further updates.`;

  test("exam names are not vacancy rows", () => {
    expect(looksLikeVacancyOrAllocationRow("S. | Name of Examination")).toBe(false);
    expect(classifyLine("S. | Name of Examination")).toBe("other");
    expect(
      classifyLine(
        "1. Assistant Section Officer / Assistant Grade Limited Departmental Competitive Examination, 2025"
      )
    ).not.toBe("vacancy");
  });

  test("publisher has no vacancy/fee/salary/age invention", () => {
    const { result, buckets } = (() => {
      const out = runGeneratorIntelligencePipeline(sitting);
      const detected = detectByLineClassification(sitting);
      return { result: out.result, buckets: detected.buckets };
    })();
    expect(result).not.toMatch(/\[Section:\s*Vacancy/i);
    expect(result).not.toMatch(/\[Section:\s*Application Fee\]/i);
    expect(result).not.toMatch(/\[Section:\s*Salary\]/i);
    expect(result).not.toMatch(/\[Section:\s*Eligibility\]/i);
    expect(result).toMatch(/\[Section:\s*Notification Details\]/i);
    expect(sectionBody(result, "Notification Details")).toMatch(/Limited Departmental Competitive Examination/i);
    expect(buckets.vacancy.join("\n")).not.toMatch(/Assistant Section Officer/);
    expect(result).not.toMatch(/application fee|₹\s*\d|age limit|pay scale/i);
  });

  test("unknown exam-name tables are not promoted to vacancy", () => {
    const tables = detectSmartTables([
      "S. | Name of Examination",
      "1 | Limited Departmental Competitive Examination 2025"
    ]);
    expect(pickPrimaryVacancyTable(tables)).toBeNull();
    if (tables[0]) expect(classifyTableKind(tables[0].csvBody.split("\n")[0], tables[0].csvBody)).not.toBe("vacancy");
  });
});

describe("Stage 4 TEST C — ordinal date normalization", () => {
  test("joins split 23 / rd / August / 2026", () => {
    const raw = `The Commission will conduct examinations at Delhi on 23
rd
August,
2026.`;
    const joined = joinSplitOrdinalDates(raw);
    expect(joined).toMatch(/23rd August,? 2026/i);
    const normalized = advancedNormalize(raw);
    expect(normalized).toMatch(/23rd August,? 2026/i);
    expect(normalized).not.toMatch(/^rd$/m);
  });
});

describe("Stage 4 TEST D — eligibility safety", () => {
  const sliding = `Staff Selection Commission
The Commission has introduced a Sliding Mechanism to fill unutilized vacancies.
Candidates are to choose the venue, date and slot for sliding process.
Any candidate failing to attend the sliding process physically will be treated as absent
and will not be considered for the final result.
The result of Tier-I was declared on 27.02.2026.`;

  test("sliding/process fragments are not eligibility or age", () => {
    expect(classifyLine("Any candidate failing to attend the sliding process physically will be treated as absent")).toBe(
      "other"
    );
    expect(classifyLine("Candidates are to choose the venue, date and slot for sliding process.")).not.toBe("age");
    expect(classifyLine("Candidates are to choose the venue, date and slot for sliding process.")).not.toBe(
      "qualification"
    );
    const { result } = runGeneratorIntelligencePipeline(sliding);
    expect(result).not.toMatch(/\[Section:\s*Eligibility\]/i);
    expect(result).not.toMatch(/Qualification:/i);
    expect(result).not.toMatch(/Age Limit:/i);
  });
});

describe("Stage 4 TEST E — official link structure", () => {
  test("bare official URL gets a valid label", () => {
    const parsed = parseLinkLine("(https://ssc.gov.in/) from 20th August 2026");
    expect(parsed).not.toBeNull();
    expect(parsed.url).toMatch(/^https:\/\/ssc\.gov\.in\/?$/);
    expect(parsed.label).toMatch(/Official Website|Link/i);
    expect(parsed.label).not.toMatch(/^\(\)$/);
    expect(parsed.label.length).toBeLessThanOrEqual(48);
  });

  test("pipeline emits Label=url for ssc.gov.in", () => {
    const src = `Staff Selection Commission
Important notice for candidates.
Sliding process login is available at (https://ssc.gov.in/) from 20th August 2026 to 22nd August 2026.`;
    const links = detectAndClassifyLinks(src.split("\n"));
    expect(links.some((l) => /ssc\.gov\.in/i.test(l.url) && /[A-Za-z]{3,}/.test(l.label))).toBe(true);
    const { result } = runGeneratorIntelligencePipeline(src);
    expect(result).toMatch(/\[Section:\s*Important Links\]/i);
    expect(sectionBody(result, "Important Links")).toMatch(/^[A-Za-z][^=]{2,}=https:\/\/ssc\.gov\.in/m);
  });
});

describe("Stage 4 — existing recruitment samples still structure", () => {
  test("SSC GD sample still has dates, fee, vacancy, links", () => {
    const { result } = runGeneratorIntelligencePipeline(SAMPLES.SSC);
    expect(result).toMatch(/\[Section:\s*Important Dates\]/i);
    expect(result).toMatch(/\[Section:\s*Application Fee\]/i);
    expect(result).toMatch(/\[Section:\s*Vacancy/i);
    expect(result).toMatch(/\[Section:\s*Important Links\]/i);
  });
});

describe("Stage 4 — AUTO_DRAFT remains off in this suite", () => {
  test(
    "processJobParse is a dry conversion only",
    withoutOpenAi(async () => {
      const { processJobParse } = require("../server/services/aiParseJob.service");
      const { getAutomationFlags } = require("../server/config/automationFlags");
      const flags = getAutomationFlags();
      expect(flags.AUTO_DRAFT_ENABLED).toBe(false);
      const out = await processJobParse(SAMPLES.SSC);
      expect(out.result).toMatch(/\[Section:/);
    })
  );
});
