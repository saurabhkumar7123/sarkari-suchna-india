"use strict";

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  DOCUMENT_VERSION,
  NORMALIZED_HTML_DOCUMENT_FORMAT_ID,
  BLOCK_TYPES,
  extractHtmlDocument,
  extractHtml,
  extractHtmlFromSourceProfile,
  documentFingerprint,
  normalizeUrl
} = require("../server/lib/contentIntelligence/htmlExtraction");

const sourceIntelligence = require("../server/lib/contentIntelligence/sourceIntelligence");
const documentClassification = require("../server/lib/contentIntelligence/documentClassification");
const metadataIntelligence = require("../server/lib/contentIntelligence/metadataIntelligence");
const editorialDecisionSupport = require("../server/lib/contentIntelligence/editorialDecisionSupport");

describe("CIP Stage 3B — HTML Extraction Intelligence Engine", () => {
  test("publishes stable engine metadata and a frozen normalized document", () => {
    const document = extractHtml("<html><head><title>Notice</title></head><body></body></html>");
    expect({
      ENGINE_ID,
      STAGE_ID,
      ENGINE_VERSION,
      DOCUMENT_VERSION,
      NORMALIZED_HTML_DOCUMENT_FORMAT_ID
    }).toEqual({
      ENGINE_ID: "CIP_HTML_EXTRACTION_ENGINE",
      STAGE_ID: "CIP_3B",
      ENGINE_VERSION: "1.0.0",
      DOCUMENT_VERSION: "1.0.0",
      NORMALIZED_HTML_DOCUMENT_FORMAT_ID: "cip_normalized_html_document_v1"
    });
    expect(document.metadata.pageTitle).toBe("Notice");
    expect(Object.isFrozen(document)).toBe(true);
    expect(Object.isFrozen(document.contentBlocks)).toBe(true);
  });

  test("extracts static and government-style HTML in source order", () => {
    const html = `
      <html lang="en"><head><title> Recruitment  Notice </title></head>
      <body>
        <h1> भर्ती सूचना </h1>
        <p>Applications   are invited.</p>
        <h2>Important Dates</h2>
        <p>Last date: 31 July.</p>
      </body></html>`;
    const document = extractHtmlDocument({
      html,
      sourceUrl: "https://recruitment.gov.in/notices/current.html"
    });
    expect(document.metadata).toEqual(
      expect.objectContaining({
        pageTitle: "Recruitment Notice",
        language: "en",
        sourceUrl: "https://recruitment.gov.in/notices/current.html"
      })
    );
    expect(document.contentBlocks.map((block) => [block.type, block.text])).toEqual([
      ["heading", "भर्ती सूचना"],
      ["paragraph", "Applications are invited."],
      ["heading", "Important Dates"],
      ["paragraph", "Last date: 31 July."]
    ]);
  });

  test("normalizes skipped heading hierarchy without changing heading text or source level", () => {
    const document = extractHtml(`
      <h1>Main</h1><p>One</p><h3>Child</h3><p>Two</p>
      <h6>Grandchild</h6><h2>Sibling</h2>
    `);
    const headings = document.contentBlocks.filter((block) => block.type === BLOCK_TYPES.HEADING);
    expect(
      headings.map((heading) => [heading.text, heading.level, heading.normalizedLevel])
    ).toEqual([
      ["Main", 1, 1],
      ["Child", 3, 2],
      ["Grandchild", 6, 3],
      ["Sibling", 2, 2]
    ]);
    expect(document.structuralTree.sections[0].subsections).toHaveLength(2);
    expect(document.structuralTree.sections[0].subsections[0].subsections).toHaveLength(1);
  });

  test("extracts nested lists without flattening their structure", () => {
    const document = extractHtml(`
      <ul><li>Eligibility<ul><li>Age 18 years</li><li>Graduate</li></ul></li><li>Fee</li></ul>
    `);
    const list = document.contentBlocks[0];
    expect(list.type).toBe("list");
    expect(list.ordered).toBe(false);
    expect(list.items[0].text).toBe("Eligibility");
    expect(list.items[0].lists[0].items.map((item) => item.text)).toEqual([
      "Age 18 years",
      "Graduate"
    ]);
    expect(document.contentBlocks).toHaveLength(1);
  });

  test("extracts table sections, spans, scope, and caption", () => {
    const document = extractHtml(`
      <table><caption>Vacancies</caption><thead><tr><th scope="col">Post</th><th>Count</th></tr></thead>
      <tbody><tr><td rowspan="2">Clerk</td><td>10</td></tr><tr><td colspan="2">5</td></tr></tbody></table>
    `);
    const table = document.contentBlocks[0];
    expect(table.caption).toBe("Vacancies");
    expect(table.rows[0].section).toBe("head");
    expect(table.rows[0].cells[0]).toEqual(
      expect.objectContaining({ type: "header", text: "Post", scope: "col" })
    );
    expect(table.rows[1].cells[0].rowSpan).toBe(2);
    expect(table.rows[2].cells[0].columnSpan).toBe(2);
  });

  test("extracts definition lists with multiple definitions", () => {
    const document = extractHtml(
      "<dl><dt>Age</dt><dd>18 years</dd><dd>Relaxation applies</dd></dl>"
    );
    expect(document.contentBlocks[0]).toEqual(
      expect.objectContaining({
        type: "definition_list",
        entries: [{ term: "Age", definitions: ["18 years", "Relaxation applies"] }]
      })
    );
  });

  test("normalizes relative and absolute URLs but preserves anchors", () => {
    const document = extractHtml(
      `<a href="../docs/notice.pdf">Notice</a>
       <a href="https://other.gov.in/result.pdf">Result</a>
       <a href="#dates">Dates</a><img src="/images/logo.png">`,
      { sourceUrl: "https://ssc.nic.in/portal/jobs/page.html" }
    );
    expect(document.resourceList.map((resource) => resource.url)).toEqual([
      "https://ssc.nic.in/portal/docs/notice.pdf",
      "https://other.gov.in/result.pdf",
      "#dates",
      "https://ssc.nic.in/images/logo.png"
    ]);
    expect(normalizeUrl("file.pdf", "https://x.gov.in/a/")).toBe("https://x.gov.in/a/file.pdf");
    expect(document.navigationReferences[0].type).toBe("anchor");
  });

  test("honors a document base element", () => {
    const document = extractHtml(
      '<head><base href="/assets/"></head><body><a href="notice.pdf">PDF</a></body>',
      { sourceUrl: "https://upsc.gov.in/exams/page" }
    );
    expect(document.metadata.baseUrl).toBe("https://upsc.gov.in/assets/");
    expect(document.resourceList[0].url).toBe("https://upsc.gov.in/assets/notice.pdf");
  });

  test("inventories PDF, notification, result, admit card, answer key, and attachment downloads", () => {
    const document = extractHtml(
      `<a href="notification.pdf">Notification</a>
       <a href="final-result.pdf">Result</a>
       <a href="admit-card.pdf">Admit Card</a>
       <a href="answer-key.pdf">Answer Key</a>
       <a href="data.xlsx">Attachment</a>`,
      { baseUrl: "https://nta.ac.in/files/" }
    );
    expect(document.resourceInventory.pdfLinks).toHaveLength(4);
    expect(document.resourceInventory.notificationDownloads).toHaveLength(1);
    expect(document.resourceInventory.resultDownloads).toHaveLength(1);
    expect(document.resourceInventory.admitCardDownloads).toHaveLength(1);
    expect(document.resourceInventory.answerKeyDownloads).toHaveLength(1);
    expect(document.resourceInventory.attachments).toHaveLength(5);
  });

  test("extracts form, button, and image metadata without field values", () => {
    const document = extractHtml(
      `<form id="apply" method="post" action="/submit">
        <input name="candidate" value="private" required>
        <select name="state"></select><button type="submit">Apply Now</button>
       </form>
       <img src="/logo.png" alt="Commission logo" width="100" loading="lazy">`,
      { baseUrl: "https://psc.gov.in/jobs/" }
    );
    const form = document.resourceInventory.forms[0];
    const button = document.resourceList.find((resource) => resource.resourceType === "button");
    const image = document.resourceInventory.images[0];
    expect(form.url).toBe("https://psc.gov.in/submit");
    expect(form.metadata.fields).toEqual([
      { tag: "input", name: "candidate", type: null, required: true },
      { tag: "select", name: "state", type: null, required: false },
      { tag: "button", name: null, type: "submit", required: false }
    ]);
    expect(JSON.stringify(form)).not.toContain("private");
    expect(button.text).toBe("Apply Now");
    expect(image).toEqual(
      expect.objectContaining({
        url: "https://psc.gov.in/logo.png",
        text: "Commission logo",
        metadata: expect.objectContaining({ width: "100", loading: "lazy" })
      })
    );
  });

  test("extracts meta tags and valid JSON-LD and warns on invalid JSON-LD", () => {
    const document = extractHtml(`
      <head>
        <meta name="description" content="Official notice">
        <meta property="og:type" content="article">
        <script type="application/ld+json">{"@type":"GovernmentService","name":"Recruitment"}</script>
        <script type="application/ld+json">{bad}</script>
      </head>
    `);
    expect(document.metadata.description).toBe("Official notice");
    expect(document.metadata.metaTags).toHaveLength(2);
    expect(document.metadata.structuredData[0].data).toEqual({
      "@type": "GovernmentService",
      name: "Recruitment"
    });
    expect(document.warnings).toContain("Invalid JSON-LD ignored at index 1.");
  });

  test("extracts linked and embedded PDF references without downloading", () => {
    const document = extractHtml(
      `<a href="/notice.pdf">Open notice</a>
       <iframe src="/result.pdf" title="Result"></iframe>
       <object data="/answer.pdf" type="application/pdf"></object>`,
      { baseUrl: "https://results.gov.in/" }
    );
    expect(document.embeddedDocuments.map((item) => item.type)).toEqual([
      "linked_pdf",
      "embedded_pdf",
      "embedded_pdf"
    ]);
    expect(document.extractionSummary.embeddedDocumentCount).toBe(3);
  });

  test("removes hidden decorative content and deterministic duplicate nodes", () => {
    const document = extractHtml(`
      <p>Keep me</p><p>Keep me</p>
      <p hidden>Hidden</p><div aria-hidden="true"><p>Also hidden</p></div>
      <p class="decorative">Decoration</p>
    `);
    expect(document.contentBlocks.map((block) => block.text)).toEqual(["Keep me"]);
    expect(document.extractionSummary.duplicateNodeCount).toBe(1);
    expect(document.extractionSummary.hiddenNodeCount).toBe(3);
  });

  test("maintains original ordering across normalized content block types", () => {
    const document = extractHtml(`
      <p>First</p><h2>Second</h2><ol><li>Third</li></ol>
      <table><tr><td>Fourth</td></tr></table><dl><dt>Fifth</dt><dd>Value</dd></dl>
    `);
    expect(document.contentBlocks.map((block) => block.type)).toEqual([
      "paragraph",
      "heading",
      "list",
      "table",
      "definition_list"
    ]);
    expect(document.contentBlocks.map((block) => block.order)).toEqual(
      [...document.contentBlocks.map((block) => block.order)].sort((a, b) => a - b)
    );
  });

  test("builds document → sections → subsections → blocks → resources", () => {
    const document = extractHtml(
      `<p>Preamble</p><h1>Notice</h1><p>Details <a href="notice.pdf">PDF</a></p>
       <h2>Dates</h2><p id="dates">Schedule</p>`,
      { baseUrl: "https://ssc.gov.in/" }
    );
    expect(document.structuralTree.type).toBe("document");
    expect(document.structuralTree.blocks[0].blockId).toBe("block-1");
    const section = document.structuralTree.sections[0];
    expect(section.type).toBe("section");
    expect(section.blocks.map((block) => block.blockId)).toEqual(["block-2", "block-3"]);
    expect(section.blocks[1].resources).toEqual(["resource-1"]);
    expect(section.subsections[0].type).toBe("subsection");
  });

  test("warns and retains relative URLs when no base URL exists", () => {
    const document = extractHtml('<a href="notice.pdf">Notice</a>');
    expect(document.resourceList[0].url).toBe("notice.pdf");
    expect(document.warnings).toContain(
      "Relative URLs were retained because no base URL was provided."
    );
  });

  test("supports Stage 3A source profiles without mutating them", () => {
    const profile = sourceIntelligence.analyzeSourceFromHtml({
      url: "https://ssc.nic.in/notice"
    });
    const before = sourceIntelligence.profileFingerprint(profile);
    const document = extractHtmlFromSourceProfile('<a href="/file.pdf">File</a>', profile);
    expect(document.metadata.sourceUrl).toBe("https://ssc.nic.in/notice");
    expect(document.metadata.sourceProfileFormatId).toBe("cip_source_profile_v1");
    expect(document.resourceList[0].url).toBe("https://ssc.nic.in/file.pdf");
    expect(sourceIntelligence.profileFingerprint(profile)).toBe(before);
  });

  test("is deterministic for identical dynamic HTML already supplied to the engine", () => {
    const input = {
      html: "<main><h1>Result</h1><p>Published</p><a href='/r.pdf'>PDF</a></main>",
      sourceUrl: "https://results.gov.in/page"
    };
    const first = extractHtmlDocument(input);
    const second = extractHtmlDocument(input);
    expect(documentFingerprint(first)).toBe(documentFingerprint(second));
    expect(first).toEqual(second);
  });

  test("can return a mutable document only when explicitly requested", () => {
    const document = extractHtml("<p>Text</p>", { freeze: false });
    expect(Object.isFrozen(document)).toBe(false);
  });

  test("rejects missing HTML rather than performing acquisition", () => {
    expect(() => extractHtmlDocument({ sourceUrl: "https://ssc.gov.in/" })).toThrow(
      "The html field must be a string."
    );
  });

  test("remains additive and backward compatible with Programs 1, 2, and Stage 3A", () => {
    expect(documentClassification.STAGE_ID).toBe("CIP_1A");
    expect(metadataIntelligence.STAGE_ID).toBe("CIP_1B");
    expect(editorialDecisionSupport.STAGE_ID).toBe("CIP_2E");
    expect(sourceIntelligence.STAGE_ID).toBe("CIP_3A");
    expect(sourceIntelligence.ENGINE_ID).toBe("CIP_SOURCE_INTELLIGENCE_ENGINE");
    expect(STAGE_ID).toBe("CIP_3B");
  });
});
