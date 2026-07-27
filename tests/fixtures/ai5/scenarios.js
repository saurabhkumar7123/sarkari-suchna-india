"use strict";

/**
 * Phase AI-5 fixtures — representative government recruitment scenarios and
 * failure simulations for end-to-end pipeline validation.
 *
 * Reuses AI-2 / AI-3 / AI-4 fixtures where available; adds scholarship,
 * admission, and failure cases not covered earlier. Text / HTML only —
 * no binary PDFs, no network, no publishing.
 */

const { NOTICES: AI2 } = require("../ai2/governmentNotices");
const {
  RECRUITMENTS,
  DUPLICATED_RECRUITMENTS,
  NOTICES: AI3
} = require("../ai3/recruitmentRepository");
const { DRAFTS: AI4_DRAFTS, PROFILE_HINTS } = require("../ai4/editorialDrafts");

/** Local kind constants — keep fixtures free of server imports. */
const SCENARIO_KINDS = Object.freeze({
  NEW_RECRUITMENT: "new_recruitment",
  RECRUITMENT_UPDATE: "recruitment_update",
  ADMIT_CARD: "admit_card",
  RESULT: "result",
  ANSWER_KEY: "answer_key",
  CORRECTION: "correction",
  CORRIGENDUM: "corrigendum",
  EXTENSION: "extension",
  EXAM_DATE: "exam_date",
  EXAM_CITY: "exam_city",
  FINAL_RESULT: "final_result",
  DV_SCHEDULE: "dv_schedule",
  SCHOLARSHIP: "scholarship",
  ADMISSION: "admission",
  APPRENTICE: "apprentice"
});

const FAILURE_KINDS = Object.freeze({
  MISSING_PDF: "missing_pdf",
  BROKEN_PDF: "broken_pdf",
  OCR_HEAVY_PDF: "ocr_heavy_pdf",
  INCOMPLETE_HTML: "incomplete_html",
  DUPLICATE_NOTICE: "duplicate_notice",
  UNKNOWN_ORGANIZATION: "unknown_organization",
  CONFLICTING_ADVT_NUMBER: "conflicting_advertisement_number",
  CONFLICTING_DATES: "conflicting_dates",
  MISSING_LINKS: "missing_links",
  LOW_CONFIDENCE_CLASSIFICATION: "low_confidence_classification",
  AMBIGUOUS_RECRUITMENT_MATCH: "ambiguous_recruitment_match"
});

/** Extra notices for scenarios AI-2/AI-3 did not cover. */
const EXTRA_NOTICES = {
  NSP_SCHOLARSHIP: {
    title: "National Scholarship Portal — Post Matric Scholarship Scheme 2026 opens",
    sourceUrl: "https://scholarships.gov.in/notice/pms-2026",
    contentType: "text/html",
    html: `<html><body>
<h1>National Scholarship Portal</h1>
<h2>Post Matric Scholarship Scheme for Students belonging to Scheduled Castes 2026</h2>
<p>Public Notice No. NSP/PMS/03/2026</p>
<p>Dated : 01/07/2026</p>
<p>Online applications are invited under the Post Matric Scholarship Scheme.</p>
<h3>Important Dates</h3>
<p>Application Begin : 01/07/2026</p>
<p>Last Date for Apply Online : 31/10/2026</p>
<a href="https://scholarships.gov.in">Official Website</a>
</body></html>`
  },

  DU_ADMISSION: {
    title: "University of Delhi — UG Admission 2026 Common Seat Allocation System",
    sourceUrl: "https://admission.uod.ac.in/ug-2026",
    contentType: "text/html",
    html: `<html><body>
<h1>University of Delhi</h1>
<h2>Undergraduate Admission 2026 — CSAS Portal Opens</h2>
<p>Notice No. DU/UG/CSAS/01/2026</p>
<p>Dated : 15/05/2026</p>
<p>Candidates may register on the Common Seat Allocation System for UG admission.</p>
<h3>Important Dates</h3>
<p>Registration Start : 15/05/2026</p>
<p>Registration Close : 15/06/2026</p>
<a href="https://ugadmission.uod.ac.in">Apply Online</a>
</body></html>`
  },

  CONFLICTING_ADVT: {
    title: "UPPSC Combined State Services 2026 — Conflicting Advertisement Numbers",
    sourceUrl: "https://uppsc.up.nic.in/conflict-advt",
    contentType: "text/html",
    html: `<html><body>
<h1>Uttar Pradesh Public Service Commission</h1>
<h2>Combined State / Upper Subordinate Services Examination 2026</h2>
<p>Advertisement No. A-1/E-1/2026</p>
<p>Reference No. A-9/E-9/2026</p>
<p>Dated : 04/09/2025</p>
<p>Online applications are invited. Advertisement No. A-9/E-9/2026 supersedes earlier notice.</p>
<h2>Important Dates</h2>
<p>Online Apply Start Date : 04/09/2025</p>
<p>Last Date for Apply Online : 30/09/2025</p>
</body></html>`
  },

  CONFLICTING_DATES: {
    title: "BPSC 71st CCE 2026 — Conflicting Last Dates in notice body",
    sourceUrl: "https://bpsc.bih.nic.in/conflict-dates",
    contentType: "text/html",
    html: `<html><body>
<h1>Bihar Public Service Commission</h1>
<h2>71st Combined Competitive Examination 2026</h2>
<p>Advertisement No. 05/2026</p>
<p>Dated : 05/02/2026</p>
<h3>Important Dates</h3>
<p>Online Apply Start Date : 05/01/2026</p>
<p>Last Date for Apply Online : 20/02/2026</p>
<p>Last Date for Apply Online : 10/02/2026</p>
<p>Fee Payment Last Date : 22/02/2026</p>
</body></html>`
  },

  MISSING_LINKS_NOTICE: {
    title: "SSC CHSL 2026 — Recruitment Advertisement without links",
    sourceUrl: "https://ssc.nic.in/chsl-2026-nolinks",
    contentType: "text/html",
    html: `<html><body>
<h1>Staff Selection Commission</h1>
<h2>Combined Higher Secondary Level Examination 2026</h2>
<p>Notice No. 12/2026-CHSL</p>
<p>Dated : 10/03/2026</p>
<p>Online applications are invited for CHSL Examination 2026.</p>
<h3>Important Dates</h3>
<p>Online Apply Start Date : 10/03/2026</p>
<p>Last Date for Apply Online : 09/04/2026</p>
</body></html>`
  },

  BROKEN_PDF_TEXT: {
    title: "Corrupt PDF extraction — unreadable binary residue",
    sourceUrl: "https://example.gov.in/broken.pdf",
    contentType: "application/pdf",
    pdfText: `\u0000\u0001PDF-1.4\n%âãÏÓ\nstream\n@@@@@@@\nendstream\n\xff\xfe\x00\x00`
  },

  MISSING_PDF: {
    title: "Notification PDF referenced but extraction empty",
    sourceUrl: "https://example.gov.in/missing.pdf",
    contentType: "application/pdf",
    pdfText: ""
  },

  INCOMPLETE_HTML: {
    title: "Partial HTML fragment",
    sourceUrl: "https://example.gov.in/partial",
    contentType: "text/html",
    html: `<html><body><p>Update published.</p>`
  },

  LOW_CONFIDENCE_NOTICE: {
    title: "Circular",
    sourceUrl: "https://obscure-board.example.in/x/99",
    contentType: "text/html",
    html: `<html><body><p>Please see attached.</p></body></html>`
  }
};

/**
 * Map scenario kind → monitoring event + draft hint + expected event type.
 * @type {Record<string, object>}
 */
const SCENARIOS = {
  [SCENARIO_KINDS.NEW_RECRUITMENT]: {
    id: "SCENARIO_NEW_RECRUITMENT",
    kind: SCENARIO_KINDS.NEW_RECRUITMENT,
    label: "New Recruitment",
    event: AI2.UPPSC_NEW_RECRUITMENT,
    draftText: AI4_DRAFTS.NEW_RECRUITMENT,
    draftProfile: PROFILE_HINTS.NEW_RECRUITMENT,
    expectedEventType: "new_recruitment",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.RECRUITMENT_UPDATE]: {
    id: "SCENARIO_RECRUITMENT_UPDATE",
    kind: SCENARIO_KINDS.RECRUITMENT_UPDATE,
    label: "Recruitment Update",
    event: AI3.UPPSC_APPLY_ONLINE,
    draftText: AI4_DRAFTS.NEW_RECRUITMENT,
    draftProfile: "new_recruitment",
    expectedEventType: "apply_online",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.ADMIT_CARD]: {
    id: "SCENARIO_ADMIT_CARD",
    kind: SCENARIO_KINDS.ADMIT_CARD,
    label: "Admit Card",
    event: AI2.SSC_ADMIT_CARD,
    draftText: AI4_DRAFTS.ADMIT_CARD,
    draftProfile: PROFILE_HINTS.ADMIT_CARD,
    expectedEventType: "admit_card",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.RESULT]: {
    id: "SCENARIO_RESULT",
    kind: SCENARIO_KINDS.RESULT,
    label: "Result",
    event: AI2.RAILWAY_TECHNICIAN_RESULT,
    draftText: AI4_DRAFTS.RESULT,
    draftProfile: PROFILE_HINTS.RESULT,
    expectedEventType: "result",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.ANSWER_KEY]: {
    id: "SCENARIO_ANSWER_KEY",
    kind: SCENARIO_KINDS.ANSWER_KEY,
    label: "Answer Key",
    event: AI3.UPPSC_ANSWER_KEY,
    draftText: AI4_DRAFTS.RESULT,
    draftProfile: "result",
    expectedEventType: "answer_key",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.CORRECTION]: {
    id: "SCENARIO_CORRECTION",
    kind: SCENARIO_KINDS.CORRECTION,
    label: "Correction",
    event: AI2.NTA_CORRECTION_WINDOW,
    draftText: AI4_DRAFTS.CORRECTION,
    draftProfile: PROFILE_HINTS.CORRECTION,
    expectedEventType: "correction",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.CORRIGENDUM]: {
    id: "SCENARIO_CORRIGENDUM",
    kind: SCENARIO_KINDS.CORRIGENDUM,
    label: "Corrigendum",
    event: AI2.DSSSB_CORRIGENDUM,
    draftText: AI4_DRAFTS.CORRECTION,
    draftProfile: "corrigendum",
    expectedEventType: "corrigendum",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.EXTENSION]: {
    id: "SCENARIO_EXTENSION",
    kind: SCENARIO_KINDS.EXTENSION,
    label: "Extension",
    event: AI2.BPSC_EXTENSION,
    draftText: AI4_DRAFTS.EXTENSION,
    draftProfile: PROFILE_HINTS.EXTENSION,
    expectedEventType: "extension_notice",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.EXAM_DATE]: {
    id: "SCENARIO_EXAM_DATE",
    kind: SCENARIO_KINDS.EXAM_DATE,
    label: "Exam Date",
    event: AI3.SSC_EXAM_DATE,
    draftText: AI4_DRAFTS.ADMIT_CARD,
    draftProfile: "exam_date",
    expectedEventType: "exam_date",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.EXAM_CITY]: {
    id: "SCENARIO_EXAM_CITY",
    kind: SCENARIO_KINDS.EXAM_CITY,
    label: "Exam City",
    event: AI2.NTA_EXAM_CITY,
    draftText: AI4_DRAFTS.ADMIT_CARD,
    draftProfile: "exam_city",
    expectedEventType: "exam_city",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.FINAL_RESULT]: {
    id: "SCENARIO_FINAL_RESULT",
    kind: SCENARIO_KINDS.FINAL_RESULT,
    label: "Final Result",
    event: AI2.UP_POLICE_FINAL_RESULT,
    draftText: AI4_DRAFTS.RESULT,
    draftProfile: "final_result",
    expectedEventType: "final_result",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.DV_SCHEDULE]: {
    id: "SCENARIO_DV_SCHEDULE",
    kind: SCENARIO_KINDS.DV_SCHEDULE,
    label: "DV Schedule",
    event: AI3.RRB_DV_SCHEDULE,
    draftText: AI4_DRAFTS.RESULT,
    draftProfile: "dv_schedule",
    expectedEventType: "dv_schedule",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.SCHOLARSHIP]: {
    id: "SCENARIO_SCHOLARSHIP",
    kind: SCENARIO_KINDS.SCHOLARSHIP,
    label: "Scholarship",
    event: EXTRA_NOTICES.NSP_SCHOLARSHIP,
    draftText: null,
    draftProfile: "scholarship",
    expectedEventType: "scholarship",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.ADMISSION]: {
    id: "SCENARIO_ADMISSION",
    kind: SCENARIO_KINDS.ADMISSION,
    label: "Admission",
    event: EXTRA_NOTICES.DU_ADMISSION,
    draftText: null,
    draftProfile: "admission",
    expectedEventType: "admission",
    recruitments: RECRUITMENTS
  },
  [SCENARIO_KINDS.APPRENTICE]: {
    id: "SCENARIO_APPRENTICE",
    kind: SCENARIO_KINDS.APPRENTICE,
    label: "Apprentice",
    event: AI2.RAILWAY_APPRENTICE,
    draftText: AI4_DRAFTS.NEW_RECRUITMENT,
    draftProfile: "apprentice",
    expectedEventType: "apprentice",
    recruitments: RECRUITMENTS
  }
};

/**
 * Failure simulation definitions.
 * @type {Record<string, object>}
 */
const FAILURES = {
  [FAILURE_KINDS.MISSING_PDF]: {
    id: "FAIL_MISSING_PDF",
    kind: FAILURE_KINDS.MISSING_PDF,
    label: "Missing PDF",
    event: EXTRA_NOTICES.MISSING_PDF,
    draftText: AI4_DRAFTS.INCOMPLETE_NOTIFICATION,
    draftProfile: "new_recruitment",
    recruitments: RECRUITMENTS,
    expectWarnings: true
  },
  [FAILURE_KINDS.BROKEN_PDF]: {
    id: "FAIL_BROKEN_PDF",
    kind: FAILURE_KINDS.BROKEN_PDF,
    label: "Broken PDF",
    event: EXTRA_NOTICES.BROKEN_PDF_TEXT,
    draftText: AI4_DRAFTS.OCR_HEAVY,
    draftProfile: "new_recruitment",
    recruitments: RECRUITMENTS,
    expectWarnings: true
  },
  [FAILURE_KINDS.OCR_HEAVY_PDF]: {
    id: "FAIL_OCR_HEAVY_PDF",
    kind: FAILURE_KINDS.OCR_HEAVY_PDF,
    label: "OCR-heavy PDF",
    event: AI2.PDF_BROKEN_HEADINGS,
    draftText: AI4_DRAFTS.OCR_HEAVY,
    draftProfile: "new_recruitment",
    recruitments: RECRUITMENTS,
    expectWarnings: true
  },
  [FAILURE_KINDS.INCOMPLETE_HTML]: {
    id: "FAIL_INCOMPLETE_HTML",
    kind: FAILURE_KINDS.INCOMPLETE_HTML,
    label: "Incomplete HTML",
    event: EXTRA_NOTICES.INCOMPLETE_HTML,
    draftText: AI4_DRAFTS.INCOMPLETE_NOTIFICATION,
    draftProfile: "new_recruitment",
    recruitments: RECRUITMENTS,
    expectWarnings: true
  },
  [FAILURE_KINDS.DUPLICATE_NOTICE]: {
    id: "FAIL_DUPLICATE_NOTICE",
    kind: FAILURE_KINDS.DUPLICATE_NOTICE,
    label: "Duplicate notice",
    event: AI2.UPPSC_NEW_RECRUITMENT,
    draftText: AI4_DRAFTS.NEW_RECRUITMENT,
    draftProfile: "new_recruitment",
    recruitments: RECRUITMENTS,
    // Same notice run twice; fingerprint compared by runner
    expectWarnings: true,
    duplicateOf: AI2.UPPSC_NEW_RECRUITMENT
  },
  [FAILURE_KINDS.UNKNOWN_ORGANIZATION]: {
    id: "FAIL_UNKNOWN_ORGANIZATION",
    kind: FAILURE_KINDS.UNKNOWN_ORGANIZATION,
    label: "Unknown organization",
    event: AI2.UNKNOWN_NOTICE,
    draftText: AI4_DRAFTS.INCOMPLETE_NOTIFICATION,
    draftProfile: "new_recruitment",
    recruitments: RECRUITMENTS,
    expectWarnings: true
  },
  [FAILURE_KINDS.CONFLICTING_ADVT_NUMBER]: {
    id: "FAIL_CONFLICTING_ADVT_NUMBER",
    kind: FAILURE_KINDS.CONFLICTING_ADVT_NUMBER,
    label: "Conflicting advertisement number",
    event: EXTRA_NOTICES.CONFLICTING_ADVT,
    draftText: AI4_DRAFTS.INCONSISTENT_DRAFT,
    draftProfile: "new_recruitment",
    recruitments: RECRUITMENTS,
    expectWarnings: true
  },
  [FAILURE_KINDS.CONFLICTING_DATES]: {
    id: "FAIL_CONFLICTING_DATES",
    kind: FAILURE_KINDS.CONFLICTING_DATES,
    label: "Conflicting dates",
    event: EXTRA_NOTICES.CONFLICTING_DATES,
    draftText: AI4_DRAFTS.INCONSISTENT_DRAFT,
    draftProfile: "new_recruitment",
    recruitments: RECRUITMENTS,
    expectWarnings: true
  },
  [FAILURE_KINDS.MISSING_LINKS]: {
    id: "FAIL_MISSING_LINKS",
    kind: FAILURE_KINDS.MISSING_LINKS,
    label: "Missing links",
    event: EXTRA_NOTICES.MISSING_LINKS_NOTICE,
    draftText: AI4_DRAFTS.INCOMPLETE_NOTIFICATION,
    draftProfile: "new_recruitment",
    recruitments: RECRUITMENTS,
    expectWarnings: true
  },
  [FAILURE_KINDS.LOW_CONFIDENCE_CLASSIFICATION]: {
    id: "FAIL_LOW_CONFIDENCE_CLASSIFICATION",
    kind: FAILURE_KINDS.LOW_CONFIDENCE_CLASSIFICATION,
    label: "Low confidence classification",
    event: EXTRA_NOTICES.LOW_CONFIDENCE_NOTICE,
    draftText: AI4_DRAFTS.INCOMPLETE_NOTIFICATION,
    draftProfile: "new_recruitment",
    recruitments: RECRUITMENTS,
    expectWarnings: true
  },
  [FAILURE_KINDS.AMBIGUOUS_RECRUITMENT_MATCH]: {
    id: "FAIL_AMBIGUOUS_RECRUITMENT_MATCH",
    kind: FAILURE_KINDS.AMBIGUOUS_RECRUITMENT_MATCH,
    label: "Ambiguous recruitment match",
    event: AI3.UNNUMBERED_FIELD_ASSISTANT_NOTICE,
    draftText: AI4_DRAFTS.NEW_RECRUITMENT,
    draftProfile: "new_recruitment",
    recruitments: [...RECRUITMENTS, ...DUPLICATED_RECRUITMENTS],
    expectWarnings: true
  }
};

function listScenarios() {
  return Object.values(SCENARIOS);
}

function listFailures() {
  return Object.values(FAILURES);
}

module.exports = {
  SCENARIO_KINDS,
  FAILURE_KINDS,
  EXTRA_NOTICES,
  SCENARIOS,
  FAILURES,
  RECRUITMENTS,
  DUPLICATED_RECRUITMENTS,
  listScenarios,
  listFailures,
  AI2,
  AI3,
  AI4_DRAFTS
};
