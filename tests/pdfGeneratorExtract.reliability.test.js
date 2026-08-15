"use strict";

const fs = require("fs");
const path = require("path");

const {
  extractGeneratorPdfText,
  textFromPdfJsContent,
  dedupeContentLines,
  shouldRunOcr,
  harvestLinkUrisFromAnnotations,
  appendHarvestedLinks,
  ocrDepsAvailable,
  OCR_TRIGGER_BELOW_CHARS,
  MAX_OCR_PAGES,
  MIN_FINAL_TEXT
} = require("../server/services/pdfGeneratorExtract.service");

const { buildPdf } = require("./helpers/minimalPdfBuilder");

const REAL_FIXTURE = path.join(
  __dirname,
  "fixtures",
  "generator-pdf",
  "ssc-cht-tentative-vacancies-09072026.pdf"
);

function pdfJsItem(str, x, y, height = 12, fontName = "g_d0_f1") {
  return {
    str,
    transform: [height, 0, 0, height, x, y],
    height,
    width: String(str).length * height * 0.5,
    fontName
  };
}

describe("Generator PDF extraction reliability", () => {
  test("normal text extraction keeps notification body, dates, and headings", () => {
    const items = [
      pdfJsItem("GOVERNMENT OF INDIA", 72, 760, 16, "Helvetica-Bold"),
      pdfJsItem("Recruitment Notification", 72, 730, 18, "Helvetica-Bold"),
      pdfJsItem("Advertisement No. SSC/CR/2026/01 dated 15/07/2026", 72, 700, 11),
      pdfJsItem("Applications are invited from eligible candidates for the posts.", 72, 670, 11),
      pdfJsItem("Important Dates", 72, 640, 15, "Helvetica-Bold"),
      pdfJsItem("Last date to apply is 31/07/2026.", 72, 610, 11),
      pdfJsItem("1. Eligibility", 72, 580, 11)
    ];
    const text = textFromPdfJsContent({ items });
    expect(text).toMatch(/Recruitment Notification/);
    expect(text).toMatch(/Important Dates/);
    expect(text).toMatch(/15\/07\/2026/);
    expect(text).toMatch(/31\/07\/2026/);
    expect(text).toMatch(/Eligibility/);
  });

  test("reading order keeps left-column body before right-column body", () => {
    const left = [];
    const right = [];
    for (let i = 0; i < 10; i++) {
      left.push(pdfJsItem(`Left eligibility line ${i} age limit details`, 70, 720 - i * 18));
      right.push(pdfJsItem(`Right apply line ${i} online steps portal`, 360, 711 - i * 18));
    }
    const text = textFromPdfJsContent({ items: [...left, ...right] });
    const leftAt = text.indexOf("Left eligibility line 0");
    const rightAt = text.indexOf("Right apply line 0");
    const leftLast = text.indexOf("Left eligibility line 9");
    expect(leftAt).toBeGreaterThanOrEqual(0);
    expect(rightAt).toBeGreaterThanOrEqual(0);
    expect(leftLast).toBeGreaterThan(leftAt);
    expect(leftLast).toBeLessThan(rightAt);
  });

  test("table-line preservation keeps row/column separators", () => {
    const items = [
      pdfJsItem("Post", 72, 700),
      pdfJsItem("Roll No", 220, 700),
      pdfJsItem("Marks", 360, 700),
      pdfJsItem("Clerk", 72, 680),
      pdfJsItem("1001", 220, 680),
      pdfJsItem("82", 360, 680),
      pdfJsItem("Clerk", 72, 660),
      pdfJsItem("1002", 220, 660),
      pdfJsItem("79", 360, 660)
    ];
    const text = textFromPdfJsContent({ items });
    expect(text).toMatch(/Post\s+\|\s+Roll No\s+\|\s+Marks/);
    expect(text).toMatch(/Clerk\s+\|\s+1001\s+\|\s+82/);
    expect(text).toMatch(/Clerk\s+\|\s+1002\s+\|\s+79/);
  });

  test("result-like table numbers survive layout extraction", () => {
    const items = [
      pdfJsItem("FINAL RESULT", 72, 740, 16, "Helvetica-Bold"),
      pdfJsItem("Post", 72, 700),
      pdfJsItem("Roll No", 220, 700),
      pdfJsItem("Marks", 360, 700),
      pdfJsItem("Clerk", 72, 680),
      pdfJsItem("1001", 220, 680),
      pdfJsItem("82", 360, 680)
    ];
    const text = textFromPdfJsContent({ items });
    expect(text).toMatch(/FINAL RESULT/);
    expect(text).toMatch(/1001/);
    expect(text).toMatch(/82/);
  });

  test("URL preservation: harvest annotations and avoid invented or duplicate URLs", () => {
    const harvested = harvestLinkUrisFromAnnotations([
      { subtype: "Link", url: "https://ssc.gov.in/Portal/Apply" },
      { subtype: "Link", unsafeUrl: "not-a-url" },
      { subtype: "Link", url: "javascript:alert(1)" }
    ]);
    expect(harvested.map((l) => l.uri)).toEqual(["https://ssc.gov.in/Portal/Apply"]);

    const withExisting = appendHarvestedLinks(
      "Visit https://ssc.gov.in/Portal/Apply today",
      harvested
    );
    expect(withExisting.match(/ssc\.gov\.in\/Portal\/Apply/g) || []).toHaveLength(1);

    const merged = appendHarvestedLinks("Visit the Commission website for updates.", harvested);
    expect(merged).toMatch(/https:\/\/ssc\.gov\.in\/Portal\/Apply/);
    expect(merged).not.toMatch(/javascript:/);
  });

  test("notification-like text keeps the official URL", () => {
    const items = [
      pdfJsItem("Visit https://ssc.nic.in/notification.pdf for updates.", 72, 550, 11)
    ];
    const text = textFromPdfJsContent({ items });
    expect(text).toMatch(/https:\/\/ssc\.nic\.in\/notification\.pdf/);
    const withAnnot = appendHarvestedLinks(text, [
      { uri: "https://ssc.nic.in/notification.pdf", label: "" }
    ]);
    expect((withAnnot.match(/ssc\.nic\.in\/notification\.pdf/g) || []).length).toBe(1);
  });

  test("heading-like larger/bold lines stay on their own line", () => {
    const items = [
      pdfJsItem("GOVERNMENT OF INDIA", 72, 760, 16, "Helvetica-Bold"),
      pdfJsItem("Recruitment Notification", 72, 730, 18, "Helvetica-Bold"),
      pdfJsItem("Applications are invited from eligible candidates for the advertised posts.", 72, 700, 11),
      pdfJsItem("Important Dates", 72, 660, 15, "Helvetica-Bold"),
      pdfJsItem("Last date to apply is 31/07/2026.", 72, 640, 11)
    ];
    const text = textFromPdfJsContent({ items });
    expect(text).toMatch(/^GOVERNMENT OF INDIA$/m);
    expect(text).toMatch(/^Recruitment Notification$/m);
    expect(text).toMatch(/^Important Dates$/m);
    expect(text).not.toMatch(/Recruitment Notification Applications are invited/);
  });

  test("OCR fallback triggers only for short or poorly spaced layers", () => {
    expect(MAX_OCR_PAGES).toBeGreaterThanOrEqual(15);
    expect(shouldRunOcr("")).toBe(true);
    expect(shouldRunOcr("x".repeat(OCR_TRIGGER_BELOW_CHARS - 1))).toBe(true);
    const good =
      "Staff Selection Commission will hold Combined Graduate Level Examination 2026 for filling up various posts. ".repeat(
        6
      );
    expect(shouldRunOcr(good)).toBe(false);
    const spaced = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z recruitment notice";
    expect(shouldRunOcr(spaced.repeat(4))).toBe(true);
    expect(typeof ocrDepsAvailable()).toBe("boolean");
  });

  test("dedup keeps legitimate repeated table lines and drops running headers", () => {
    const kept = dedupeContentLines(
      [
        "Post | Category | Total",
        "Constable | UR | 17000",
        "Constable | OBC | 9500",
        "Constable | UR | 17000",
        "Last date 31/07/2026",
        "Last date 31/07/2026"
      ].join("\n")
    );
    expect(kept.match(/Constable \| UR \| 17000/g)).toHaveLength(2);
    expect(kept.match(/Last date 31\/07\/2026/g)).toHaveLength(2);

    const headers = dedupeContentLines(
      [
        "UNION PUBLIC SERVICE COMMISSION",
        "Detailed Advertisement",
        "UNION PUBLIC SERVICE COMMISSION",
        "Selection Process",
        "UNION PUBLIC SERVICE COMMISSION",
        "General Instructions"
      ].join("\n")
    );
    expect(headers.match(/UNION PUBLIC SERVICE COMMISSION/g)).toHaveLength(1);
    expect(headers).toMatch(/Detailed Advertisement/);
    expect(headers).toMatch(/Selection Process/);
  });

  test("empty PDF stays INVALID_PDF", async () => {
    await expect(extractGeneratorPdfText(Buffer.alloc(0))).rejects.toMatchObject({
      code: "INVALID_PDF"
    });
  });

  test(
    "tiny readable PDF still yields TEXT_TOO_SHORT",
    async () => {
      const tiny = buildPdf({
        pages: [{ lines: [{ text: "Hi", y: 720 }] }]
      });
      await expect(extractGeneratorPdfText(tiny)).rejects.toMatchObject({
        code: "TEXT_TOO_SHORT"
      });
    },
    120000
  );

  test("output contract is { text, extractionNote? } on a real PDF", async () => {
    if (!fs.existsSync(REAL_FIXTURE)) return;
    const out = await extractGeneratorPdfText(fs.readFileSync(REAL_FIXTURE));
    expect(Object.keys(out).every((k) => k === "text" || k === "extractionNote")).toBe(true);
    expect(typeof out.text).toBe("string");
    expect(out.text.length).toBeGreaterThan(MIN_FINAL_TEXT);
    if (out.extractionNote !== undefined) expect(typeof out.extractionNote).toBe("string");
  });

  test("repeated header fixture body lines are preserved by dedup", () => {
    const text = [
      "UNION PUBLIC SERVICE COMMISSION",
      "Detailed Advertisement",
      "Selection Process",
      "https://upsc.gov.in/notice.pdf",
      "UNION PUBLIC SERVICE COMMISSION",
      "UNION PUBLIC SERVICE COMMISSION"
    ].join("\n");
    const out = dedupeContentLines(text);
    expect(out).toMatch(/Detailed Advertisement/);
    expect(out).toMatch(/Selection Process/);
    expect(out).toMatch(/https:\/\/upsc\.gov\.in\/notice\.pdf/);
  });
});

describe("Real official government PDF fixture", () => {
  const present = fs.existsSync(REAL_FIXTURE);

  test("SSC Combined Hindi Translators tentative vacancies PDF is present", () => {
    expect(present).toBe(true);
    if (!present) return;
    const buf = fs.readFileSync(REAL_FIXTURE);
    expect(buf.slice(0, 4).toString("latin1")).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(10000);
    expect(buf.length).toBeLessThan(600000);
  });

  test("extracts dates, headings, and table-like vacancy lines from the official fixture", async () => {
    if (!present) return;
    const buf = fs.readFileSync(REAL_FIXTURE);
    const out = await extractGeneratorPdfText(buf);
    expect(out.text.length).toBeGreaterThan(MIN_FINAL_TEXT);
    expect(out.text).toMatch(/COMBINED HINDI TRANSLATORS|Hindi Translators/i);
    expect(out.text).toMatch(/TENTATIVE VACANCIES|Vacancies/i);
    expect(out.text).toMatch(/09[./-]07[./-]2026|09\.07\.2026|09-07-2026|09\/07\/2026/);
    expect(out.text).toMatch(/Ministry|Department|Office/i);
    expect(out.text).toMatch(/Senior Translator|Junior Translator|Pay Level/i);
    expect(/\d{2,}/.test(out.text)).toBe(true);
    expect(out.text).toMatch(/UR|OBC|EWS|SC|ST/);
  });
});
