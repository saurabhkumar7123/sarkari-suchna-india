"use strict";

/**
 * Real Generator Manual Publish E2E (local only).
 * Draft → Approve (no publish) → POST /api/admin/pages Manual Publish.
 */

require("dotenv").config();

const request = require("supertest");
const app = require("../server/app");
const db = require("../server/config/db");
const recruitmentService = require("../server/services/recruitment.service");
const recruitmentLifecycleService = require("../server/services/recruitmentLifecycle.service");
const recruitmentReviewService = require("../server/services/recruitmentReview.service");
const generatorDraftService = require("../server/services/generatorDraft.service");
const recruitmentPageLinkService = require("../server/services/recruitmentPageLink.service");
const { isAutoPublishBlocked } = require("../server/config/automationFlags");

const PREFIX = `gen-e2e-${Date.now()}`;
const results = [];

function record(name, pass, detail) {
  results.push({ name, pass: Boolean(pass), detail: detail || "" });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function countPages(recruitmentId) {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS c FROM pages WHERE recruitment_id = ? AND deleted = 0",
    [recruitmentId]
  );
  return Number(rows[0].c || 0);
}

async function loginAgent() {
  const agent = request.agent(app);
  const login = await agent.post("/api/admin/login").send({
    username: "admin",
    password: "123456"
  });
  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status}`);
  }
  const csrf = await agent.get("/api/admin/csrf-token");
  const token = csrf.body && csrf.body.csrfToken;
  if (!token) throw new Error("csrf token missing");
  return { agent, token };
}

async function manualPublish(agent, token, body) {
  return agent
    .post("/api/admin/pages")
    .set("X-CSRF-Token", token)
    .set("Content-Type", "application/json")
    .send(body);
}

(async () => {
  console.log("\n=== Real Generator Manual Publish E2E ===\n");
  record("AUTO_PUBLISH blocked", isAutoPublishBlocked(), "");

  const { agent, token } = await loginAgent();

  // --- New recruitment path ---
  const recNew = await recruitmentService.createRecruitment({
    title: `${PREFIX} New Recruitment`,
    slug: `${PREFIX}-new-rec`,
    department: "E2E",
    lifecycle_state: "announced"
  });
  const manualNew = await recruitmentLifecycleService.createManualRecruitmentUpdate({
    recruitmentId: recNew.id,
    eventType: "notification",
    title: `${PREFIX} New Draft`
  });
  const pagesBeforeApprove = await countPages(recNew.id);
  await recruitmentReviewService.updateReviewDecision(manualNew.review.id, {
    decision: "approve",
    notes: "approve before manual publish"
  });
  const pagesAfterApprove = await countPages(recNew.id);
  record(
    "Approve does not publish (new recruitment)",
    pagesBeforeApprove === 0 && pagesAfterApprove === 0,
    `pages ${pagesBeforeApprove}→${pagesAfterApprove}`
  );

  const draftNew = await generatorDraftService.getDraftById(manualNew.draft.id);
  const slugNew = `${PREFIX}-new-public`;
  const pubNew = await manualPublish(agent, token, {
    title: draftNew.title || `${PREFIX} New Public`,
    status: "latest job",
    category: "Central",
    content: `[Section: Short Information]\n${PREFIX} new recruitment published content.`,
    text: `[Section: Short Information]\n${PREFIX} new recruitment published content.`,
    smallBoxSlot: null,
    generatorDraftId: draftNew.id,
    recruitment_id: recNew.id,
    recruitment_event_id: manualNew.recruitmentEventId || draftNew.recruitment_event_id,
    pageUrl: slugNew
  });
  const pubNewOk = pubNew.status === 200 || pubNew.status === 201;
  const draftAfterPub = await generatorDraftService.getDraftById(draftNew.id);
  const pagesAfterPub = await countPages(recNew.id);
  let canonNew = null;
  try {
    canonNew = await recruitmentPageLinkService.resolveCanonicalPublicPage(recNew.id);
  } catch (err) {
    record(
      "Manual Publish creates public page (new recruitment)",
      false,
      `canon resolve failed: ${err.message}; http=${pubNew.status} body=${JSON.stringify(pubNew.body)}`
    );
    throw err;
  }
  record(
    "Manual Publish creates public page (new recruitment)",
    pubNewOk &&
      String(draftAfterPub.status) === "published" &&
      pagesAfterPub === 1 &&
      canonNew &&
      canonNew.status === "unique" &&
      !canonNew.ambiguous,
    `http=${pubNew.status} draft=${draftAfterPub.status} pages=${pagesAfterPub} canon=${canonNew && canonNew.status} msg=${pubNew.body && pubNew.body.message}`
  );

  if (!canonNew || !canonNew.page) {
    throw new Error("canonical page missing after first publish");
  }

  // --- Existing recruitment update stays on same canonical page ---
  const admit = await recruitmentLifecycleService.createManualRecruitmentUpdate({
    recruitmentId: recNew.id,
    eventType: "admit_card",
    title: `${PREFIX} Admit Card Draft`
  });
  await recruitmentReviewService.updateReviewDecision(admit.review.id, {
    decision: "approve",
    notes: "approve admit card"
  });
  const pagesBeforeAdmitPub = await countPages(recNew.id);
  const pubAdmit = await manualPublish(agent, token, {
    title: `${PREFIX} Admit Card Update`,
    status: "admit card",
    category: "Central",
    content: `[Section: Short Information]\n${PREFIX} admit card update on same page.`,
    text: `[Section: Short Information]\n${PREFIX} admit card update on same page.`,
    smallBoxSlot: null,
    generatorDraftId: admit.draft.id,
    recruitment_id: recNew.id,
    recruitment_event_id: admit.recruitmentEventId,
    oldSlug: canonNew.page.slug,
    pageUrl: canonNew.page.slug
  });
  const pagesAfterAdmitPub = await countPages(recNew.id);
  const canonAfterAdmit = await recruitmentPageLinkService.resolveCanonicalPublicPage(recNew.id);
  const recrCount = await db
    .query("SELECT COUNT(*) AS c FROM recruitments WHERE title LIKE ?", [`${PREFIX}%`])
    .then(([r]) => Number(r[0].c));
  record(
    "Subsequent Admit Card stays on same canonical page (no duplicate)",
    (pubAdmit.status === 200 || pubAdmit.status === 201) &&
      pagesBeforeAdmitPub === 1 &&
      pagesAfterAdmitPub === 1 &&
      canonAfterAdmit &&
      canonAfterAdmit.status === "unique" &&
      Number(canonAfterAdmit.page.id) === Number(canonNew.page.id) &&
      recrCount === 1,
    `http=${pubAdmit.status} pages=${pagesAfterAdmitPub} samePage=${canonAfterAdmit && canonAfterAdmit.page && canonAfterAdmit.page.id} recrCount=${recrCount} msg=${pubAdmit.body && pubAdmit.body.message}`
  );

  // --- Second new recruitment gets its own page ---
  const rec2 = await recruitmentService.createRecruitment({
    title: `${PREFIX} Second Recruitment`,
    slug: `${PREFIX}-second-rec`,
    department: "E2E"
  });
  const manual2 = await recruitmentLifecycleService.createManualRecruitmentUpdate({
    recruitmentId: rec2.id,
    eventType: "notification",
    title: `${PREFIX} Second Draft`
  });
  await recruitmentReviewService.updateReviewDecision(manual2.review.id, {
    decision: "approve",
    notes: "approve second"
  });
  const slug2 = `${PREFIX}-second-public`;
  const pub2 = await manualPublish(agent, token, {
    title: `${PREFIX} Second Public`,
    status: "latest job",
    category: "Central",
    content: `[Section: Short Information]\n${PREFIX} second recruitment page.`,
    text: `[Section: Short Information]\n${PREFIX} second recruitment page.`,
    smallBoxSlot: null,
    generatorDraftId: manual2.draft.id,
    recruitment_id: rec2.id,
    recruitment_event_id: manual2.recruitmentEventId,
    pageUrl: slug2
  });
  const pages2 = await countPages(rec2.id);
  const pages1Still = await countPages(recNew.id);
  record(
    "New recruitment does not duplicate other recruitment canonical page",
    (pub2.status === 200 || pub2.status === 201) && pages2 === 1 && pages1Still === 1,
    `http=${pub2.status} pages2=${pages2} pages1=${pages1Still}`
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\nGenerator E2E: Passed ${results.length - failed.length} / ${results.length}`);
  if (failed.length) {
    for (const f of failed) console.log(`FAIL detail: ${f.name} → ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error("Generator E2E crashed:", err);
  process.exit(2);
});
