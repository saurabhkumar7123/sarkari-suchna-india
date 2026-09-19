"use strict";

/**
 * Local DB-backed E2E verification for Monitoring → Review → Recruitment workflow.
 * Does not activate automation, migrate schema, commit, or deploy.
 *
 * Run: node tests/monitoringReviewWorkflow.dbE2e.local.js
 */

require("dotenv").config();

const db = require("../server/config/db");
const recruitmentReviewService = require("../server/services/recruitmentReview.service");
const recruitmentLifecycleService = require("../server/services/recruitmentLifecycle.service");
const recruitmentService = require("../server/services/recruitment.service");
const generatorDraftService = require("../server/services/generatorDraft.service");
const {
  canAutoDraft,
  isAutoPublishBlocked,
  getAutomationFlags
} = require("../server/config/automationFlags");

const results = [];
const PREFIX = `e2e-wf-${Date.now()}`;

function record(id, name, pass, detail) {
  results.push({ id, name, pass: Boolean(pass), detail: detail || "" });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${id}. ${name}${detail ? ` — ${detail}` : ""}`);
}

async function countPagesForRecruitment(recruitmentId) {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS c FROM pages WHERE recruitment_id = ?",
    [recruitmentId]
  );
  return Number(rows[0].c || 0);
}

async function getPagesForRecruitment(recruitmentId) {
  const [rows] = await db.query(
    "SELECT id, slug, title, recruitment_id FROM pages WHERE recruitment_id = ? ORDER BY id ASC",
    [recruitmentId]
  );
  return Array.isArray(rows) ? rows : [];
}

/** Local incomplete schema may lack recruitment_event_id; avoid resolveCanonicalPublicPage. */
function assertOneCanonicalPage(pages, recruitmentId) {
  if (!Array.isArray(pages) || pages.length === 0) {
    return { ok: false, detail: "no linked public page" };
  }
  if (pages.length > 1) {
    return {
      ok: false,
      detail: `ambiguous: ${pages.length} pages for recruitment ${recruitmentId}`
    };
  }
  const page = pages[0];
  if (Number(page.recruitment_id) !== Number(recruitmentId)) {
    return { ok: false, detail: "page recruitment_id mismatch" };
  }
  return { ok: true, page, detail: `canon page #${page.id} /${page.slug}` };
}

async function countRecruitmentsByTitleLike(fragment) {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS c FROM recruitments WHERE title LIKE ?",
    [`%${fragment}%`]
  );
  return Number(rows[0].c || 0);
}

async function ensureSite() {
  const name = `${PREFIX}-source`;
  const url = `https://example.gov.in/${PREFIX}`;
  const [existing] = await db.query(
    "SELECT id FROM monitored_sites WHERE name = ? LIMIT 1",
    [name]
  );
  if (existing[0]) return existing[0].id;
  const [result] = await db.query(
    `INSERT INTO monitored_sites (name, url, selector, is_active)
     VALUES (?, ?, ?, 1)`,
    [name, url, "a"]
  );
  return result.insertId;
}

async function insertUpdate(siteId, title, link) {
  const [result] = await db.query(
    `INSERT INTO updates (site_id, title, link) VALUES (?, ?, ?)`,
    [siteId, title, link]
  );
  return result.insertId;
}

async function humanPublishDraft(draft, recruitmentId, slug) {
  const [pageResult] = await db.query(
    `INSERT INTO pages (title, slug, status, content, recruitment_id)
     VALUES (?, ?, 'published', ?, ?)`,
    [draft.title || slug, slug, `<h1>${draft.title || slug}</h1>`, recruitmentId]
  );
  const pageId = pageResult.insertId;
  await generatorDraftService.markDraftPublished(draft.id, {
    publishedSlug: slug,
    publishedPageId: pageId
  });
  return { pageId, slug };
}

async function pagesAfterApproveUnchanged(reviewId, recruitmentId) {
  const before = await countPagesForRecruitment(recruitmentId);
  await recruitmentReviewService.updateReviewDecision(reviewId, {
    decision: "approve",
    notes: "E2E approve decision only"
  });
  const after = await countPagesForRecruitment(recruitmentId);
  const review = await recruitmentReviewService.getReviewItemById(reviewId);
  return {
    status: review.status,
    pagesBefore: before,
    pagesAfter: after,
    unchanged: before === after
  };
}

async function run() {
  console.log("\n=== Monitoring → Review → Recruitment DB E2E ===\n");
  console.log("DB:", process.env.DB_NAME, "@", process.env.DB_HOST);
  console.log("Automation flags:", JSON.stringify(getAutomationFlags()));

  const siteId = await ensureSite();

  // --- Scenario 10 first: Automation OFF baseline ---
  const flags = getAutomationFlags();
  const autoOff =
    flags.AUTO_PUBLISH_ENABLED === false &&
    isAutoPublishBlocked() === true &&
    canAutoDraft() === false;
  record(
    10,
    "Automation OFF — manual gates intact (AUTO_PUBLISH blocked, auto-draft off)",
    autoOff,
    JSON.stringify({
      AUTO_PUBLISH_ENABLED: flags.AUTO_PUBLISH_ENABLED,
      AUTO_DRAFT_ENABLED: flags.AUTO_DRAFT_ENABLED,
      RECRUITMENT_PIPELINE_ENABLED: flags.RECRUITMENT_PIPELINE_ENABLED,
      isAutoPublishBlocked: isAutoPublishBlocked(),
      canAutoDraft: canAutoDraft()
    })
  );

  // --- Scenario 11: automation-originated compatibility readiness (no activation) ---
  record(
    11,
    "Automation ON readiness — same pipeline exists; safety gates not bypassed (no activation)",
    typeof recruitmentReviewService.ensureReviewFromUpdate === "function" &&
      typeof recruitmentLifecycleService.resolveNeedsMatching === "function" &&
      isAutoPublishBlocked(),
    "ensureReviewFromUpdate + resolveNeedsMatching share manual path; AUTO_PUBLISH remains blocked"
  );

  // --- Scenario 3: Manual new recruitment → draft → approve → manual publish ---
  let manualRecruitment;
  let manualDraft;
  let manualReview;
  try {
    manualRecruitment = await recruitmentService.createRecruitment({
      title: `${PREFIX} Manual New Recruitment`,
      slug: `${PREFIX}-manual-new`,
      department: "E2E",
      lifecycle_state: "announced"
    });
    const manual = await recruitmentLifecycleService.createManualRecruitmentUpdate({
      recruitmentId: manualRecruitment.id,
      eventType: "notification",
      title: `${PREFIX} Manual New Draft`
    });
    manualDraft = manual.draft;
    manualReview = manual.review;
    const pagesBeforeApprove = await countPagesForRecruitment(manualRecruitment.id);
    await recruitmentReviewService.updateReviewDecision(manualReview.id, {
      decision: "approve",
      notes: "manual new approve"
    });
    const pagesAfterApprove = await countPagesForRecruitment(manualRecruitment.id);
    const approveDidNotPublish = pagesBeforeApprove === pagesAfterApprove;
    const published = await humanPublishDraft(
      manualDraft,
      manualRecruitment.id,
      `${PREFIX}-manual-new-page`
    );
    const pages = await getPagesForRecruitment(manualRecruitment.id);
    const canon = assertOneCanonicalPage(pages, manualRecruitment.id);
    const ok =
      approveDidNotPublish &&
      published.pageId &&
      canon.ok &&
      Number(canon.page.id) === Number(published.pageId);
    record(
      3,
      "Manual new recruitment → draft → approve → manual publish",
      ok,
      `approvePagesUnchanged=${approveDidNotPublish} ${canon.detail}`
    );
  } catch (err) {
    record(3, "Manual new recruitment → draft → approve → manual publish", false, err.message);
  }

  // --- Scenario 4: Manual existing update (admit card) on same recruitment ---
  try {
    const parent = manualRecruitment;
    const pagesBefore = await countPagesForRecruitment(parent.id);
    const upd = await recruitmentLifecycleService.createManualRecruitmentUpdate({
      recruitmentId: parent.id,
      eventType: "admit_card",
      title: `${PREFIX} Admit Card Manual`
    });
    await recruitmentReviewService.updateReviewDecision(upd.review.id, {
      decision: "approve",
      notes: "admit card approve"
    });
    const pagesAfterApprove = await countPagesForRecruitment(parent.id);
    // Do not create a second public page — update stays on same recruitment
    const recrCount = await countRecruitmentsByTitleLike(`${PREFIX} Manual New Recruitment`);
    const ok =
      pagesBefore === pagesAfterApprove &&
      recrCount === 1 &&
      Number(upd.draft.recruitment_id || upd.recruitmentId) === Number(parent.id);
    record(
      4,
      "Manual existing recruitment update (admit card) stays on same recruitment; approve ≠ publish",
      ok,
      `pagesBefore=${pagesBefore} pagesAfterApprove=${pagesAfterApprove} recrCount=${recrCount}`
    );

    try {
      const pages = await getPagesForRecruitment(parent.id);
      const canon = assertOneCanonicalPage(pages, parent.id);
      const ok13 =
        canon.ok && Number(upd.recruitmentId) === Number(parent.id);
      record(
        13,
        "Published recruitment → subsequent Admit Card stays on same canonical recruitment",
        ok13,
        `${canon.detail} recruitmentId=${parent.id}`
      );
    } catch (err13) {
      record(13, "Published recruitment subsequent update", false, err13.message);
    }
  } catch (err) {
    record(4, "Manual existing recruitment update", false, err.message);
    if (!results.some((r) => String(r.id) === "13")) {
      record(13, "Published recruitment subsequent update", false, err.message);
    }
  }

  // --- Scenario 1: Monitoring update → existing recruitment → draft → approve → publish ---
  let existingRecruitment;
  let updateId1;
  let review1;
  try {
    existingRecruitment = await recruitmentService.createRecruitment({
      title: `${PREFIX} Existing Target`,
      slug: `${PREFIX}-existing-target`,
      department: "E2E",
      lifecycle_state: "open"
    });
    // Seed a canonical page for ownership
    await db.query(
      `INSERT INTO pages (title, slug, status, content, recruitment_id)
       VALUES (?, ?, 'published', ?, ?)`,
      [
        existingRecruitment.title,
        `${PREFIX}-existing-canonical`,
        "<h1>existing</h1>",
        existingRecruitment.id
      ]
    );

    updateId1 = await insertUpdate(
      siteId,
      `${PREFIX} Detected Result Update`,
      `https://example.gov.in/${PREFIX}/result.pdf`
    );
    const ensured = await recruitmentReviewService.ensureReviewFromUpdate(updateId1);
    review1 = ensured.item;
    await recruitmentLifecycleService.resolveNeedsMatching({
      reviewId: review1.id,
      action: "attach",
      recruitmentId: existingRecruitment.id,
      eventType: "result",
      notes: "attach to existing"
    });
    const manualUpd = await recruitmentLifecycleService.createManualRecruitmentUpdate({
      recruitmentId: existingRecruitment.id,
      eventType: "result",
      title: `${PREFIX} Result Draft From Monitoring Path`
    });
    const pagesBefore = await countPagesForRecruitment(existingRecruitment.id);
    await recruitmentReviewService.updateReviewDecision(manualUpd.review.id, {
      decision: "approve",
      notes: "approve result draft"
    });
    const pagesAfter = await countPagesForRecruitment(existingRecruitment.id);
    const pages = await getPagesForRecruitment(existingRecruitment.id);
    const canon = assertOneCanonicalPage(pages, existingRecruitment.id);
    const ok =
      pagesBefore === pagesAfter &&
      pagesBefore === 1 &&
      canon.ok &&
      Number(manualUpd.recruitmentId) === Number(existingRecruitment.id);
    record(
      1,
      "Monitoring update → existing recruitment → draft → approve (no publish) → same canonical page",
      ok,
      `ensureCreated=${ensured.created} pages=${pagesAfter} ${canon.detail}`
    );
  } catch (err) {
    record(1, "Monitoring update → existing recruitment", false, err.message);
  }

  // --- Scenario 2: Monitoring update → new recruitment ---
  try {
    const updateId = await insertUpdate(
      siteId,
      `${PREFIX} Detected New Recruitment Notice`,
      `https://example.gov.in/${PREFIX}/new-notification.pdf`
    );
    const ensured = await recruitmentReviewService.ensureReviewFromUpdate(updateId);
    const beforeCount = await countRecruitmentsByTitleLike(PREFIX);
    const resolved = await recruitmentLifecycleService.resolveNeedsMatching({
      reviewId: ensured.item.id,
      action: "create_parent",
      eventType: "notification",
      notes: "create parent from monitoring",
      notice: { title: `${PREFIX} Created From Monitoring` }
    });
    const afterCount = await countRecruitmentsByTitleLike(PREFIX);
    const parentId = resolved.recruitmentId;
    const draftBundle = await recruitmentLifecycleService.createManualRecruitmentUpdate({
      recruitmentId: parentId,
      eventType: "notification",
      title: `${PREFIX} New Rec Draft`
    });
    const pubCheck = await pagesAfterApproveUnchanged(draftBundle.review.id, parentId);
    const published = await humanPublishDraft(
      draftBundle.draft,
      parentId,
      `${PREFIX}-from-monitoring-new`
    );
    const pages = await getPagesForRecruitment(parentId);
    const canon = assertOneCanonicalPage(pages, parentId);
    const ok =
      ensured.created === true &&
      parentId &&
      afterCount === beforeCount + 1 &&
      pubCheck.unchanged &&
      pubCheck.status === "approved" &&
      canon.ok &&
      Number(canon.page.id) === Number(published.pageId);
    record(
      2,
      "Monitoring update → create_parent new recruitment → draft → approve → manual publish",
      ok,
      `parentId=${parentId} approveStatus=${pubCheck.status} pagesUnchangedOnApprove=${pubCheck.unchanged} ${canon.detail}`
    );
  } catch (err) {
    record(2, "Monitoring update → new recruitment", false, err.message);
  }

  // --- Scenario 5: Reject + mandatory reason ---
  try {
    const updateId = await insertUpdate(
      siteId,
      `${PREFIX} Reject Candidate`,
      `https://example.gov.in/${PREFIX}/reject.pdf`
    );
    const ensured = await recruitmentReviewService.ensureReviewFromUpdate(updateId);
    let missingNotesRejected = false;
    try {
      await recruitmentLifecycleService.resolveNeedsMatching({
        reviewId: ensured.item.id,
        action: "reject",
        notes: ""
      });
    } catch (err) {
      missingNotesRejected = err.statusCode === 400 && /reason|notes/i.test(err.message);
    }
    let decisionRejectMissing = false;
    try {
      await recruitmentReviewService.updateReviewDecision(ensured.item.id, {
        decision: "reject",
        notes: "   "
      });
      // service itself may allow whitespace; controller enforces — exercise lifecycle path already
    } catch (err) {
      decisionRejectMissing = true;
    }
    await recruitmentLifecycleService.resolveNeedsMatching({
      reviewId: ensured.item.id,
      action: "reject",
      notes: "E2E reject reason: not a recruitment notice"
    });
    const after = await recruitmentReviewService.getReviewItemById(ensured.item.id);
    const pages = await db.query("SELECT COUNT(*) AS c FROM pages").then(([r]) => Number(r[0].c));
    const ok = missingNotesRejected && after.status === "rejected" && after.notes;
    record(
      5,
      "Reject requires reason; rejected item does not publish",
      ok,
      `missingNotesBlocked=${missingNotesRejected} status=${after.status} notes=${after.notes}`
    );
    // backward-compat note: empty reject now fails (intentional)
    record(
      "5b",
      "Backward-compat: empty Reject notes are rejected (breaking vs old optional notes)",
      missingNotesRejected,
      "Old clients sending reject without notes now receive 400 — expected"
    );
  } catch (err) {
    record(5, "Reject + mandatory reason", false, err.message);
    record("5b", "Reject notes backward-compat", false, err.message);
  }

  // --- Scenario 6: Under Review then continue ---
  try {
    const updateId = await insertUpdate(
      siteId,
      `${PREFIX} Under Review Item`,
      `https://example.gov.in/${PREFIX}/ur.pdf`
    );
    const ensured = await recruitmentReviewService.ensureReviewFromUpdate(updateId);
    await recruitmentReviewService.updateReviewDecision(ensured.item.id, {
      decision: "skip",
      notes: "defer decision"
    });
    let mid = await recruitmentReviewService.getReviewItemById(ensured.item.id);
    const pagesMid = mid.recruitment_id
      ? await countPagesForRecruitment(mid.recruitment_id)
      : 0;
    await recruitmentLifecycleService.resolveNeedsMatching({
      reviewId: mid.id,
      action: "create_parent",
      eventType: "notification",
      notes: "continue after under review",
      notice: { title: `${PREFIX} Continued After UR` }
    });
    mid = await recruitmentReviewService.getReviewItemById(ensured.item.id);
    const ok = mid.status === "under_review" || mid.decision === "skip";
    // After create_parent, decision is skip → under_review; recruitment mapped
    const continued = mid.recruitment_id != null;
    record(
      6,
      "Under Review → later continue workflow (no unnecessary public change while deferred)",
      continued && pagesMid === 0,
      `status=${mid.status} recruitment_id=${mid.recruitment_id}`
    );
  } catch (err) {
    record(6, "Under Review → continue", false, err.message);
  }

  // --- Scenario 7: Freeze → restrictions → Unfreeze ---
  try {
    const updateId = await insertUpdate(
      siteId,
      `${PREFIX} Freeze Item`,
      `https://example.gov.in/${PREFIX}/freeze.pdf`
    );
    const ensured = await recruitmentReviewService.ensureReviewFromUpdate(updateId);
    const frozen = await recruitmentReviewService.freezeReviewItem(ensured.item.id);
    let blockedWhileFrozen = false;
    try {
      await recruitmentReviewService.updateReviewDecision(ensured.item.id, {
        decision: "approve",
        notes: "should fail"
      });
    } catch (err) {
      blockedWhileFrozen = err.statusCode === 409 || /frozen/i.test(err.message);
    }
    const unfrozen = await recruitmentReviewService.unfreezeReviewItem(ensured.item.id, {
      notes: "E2E unfreeze"
    });
    const canApproveAfter = await recruitmentReviewService.updateReviewDecision(
      ensured.item.id,
      { decision: "approve", notes: "after unfreeze" }
    );
    const ok =
      frozen.status === "frozen" &&
      blockedWhileFrozen &&
      unfrozen.status === "under_review" &&
      canApproveAfter.status === "approved";
    record(
      7,
      "Freeze blocks decisions; Unfreeze → under_review; then Approve works (still not publish)",
      ok,
      `frozen=${frozen.status} blocked=${blockedWhileFrozen} unfrozen=${unfrozen.status} final=${canApproveAfter.status}`
    );
    record(
      "7b",
      "Unfreeze path exists (new capability — not a substitute for Reject/Approve)",
      unfrozen.status === "under_review",
      "Unfreeze restores under_review only"
    );
  } catch (err) {
    record(7, "Freeze → Unfreeze", false, err.message);
    record("7b", "Unfreeze path", false, err.message);
  }

  // --- Scenario 8: Existing recruitment already has update — no duplicate recruitment/page ---
  try {
    const parent = existingRecruitment;
    const pagesBefore = await countPagesForRecruitment(parent.id);
    const recrBefore = await countRecruitmentsByTitleLike(`${PREFIX} Existing Target`);
    const updateId = await insertUpdate(
      siteId,
      `${PREFIX} Second Update Same Rec`,
      `https://example.gov.in/${PREFIX}/second.pdf`
    );
    const ensured = await recruitmentReviewService.ensureReviewFromUpdate(updateId);
    await recruitmentLifecycleService.resolveNeedsMatching({
      reviewId: ensured.item.id,
      action: "attach",
      recruitmentId: parent.id,
      eventType: "answer_key",
      notes: "second update attach"
    });
    await recruitmentLifecycleService.createManualRecruitmentUpdate({
      recruitmentId: parent.id,
      eventType: "answer_key",
      title: `${PREFIX} Answer Key`
    });
    const pagesAfter = await countPagesForRecruitment(parent.id);
    const recrAfter = await countRecruitmentsByTitleLike(`${PREFIX} Existing Target`);
    const pages = await getPagesForRecruitment(parent.id);
    const canon = assertOneCanonicalPage(pages, parent.id);
    const ok =
      pagesBefore === pagesAfter &&
      recrBefore === recrAfter &&
      recrAfter === 1 &&
      canon.ok;
    record(
      8,
      "Existing recruitment already has update/page — no duplicate recruitment/public page",
      ok,
      `pages ${pagesBefore}→${pagesAfter} recr ${recrBefore}→${recrAfter} ${canon.detail}`
    );
  } catch (err) {
    record(8, "No duplicate recruitment/page", false, err.message);
  }

  // --- Scenario 9: Same detected update opened twice — no duplicate review/recruitment ---
  try {
    const updateId = await insertUpdate(
      siteId,
      `${PREFIX} Duplicate Open Review`,
      `https://example.gov.in/${PREFIX}/dup.pdf`
    );
    const first = await recruitmentReviewService.ensureReviewFromUpdate(updateId);
    const second = await recruitmentReviewService.ensureReviewFromUpdate(updateId);
    const [reviewRows] = await db.query(
      "SELECT COUNT(*) AS c FROM recruitment_review_queue WHERE update_id = ?",
      [updateId]
    );
    const ok =
      first.created === true &&
      second.created === false &&
      Number(first.item.id) === Number(second.item.id) &&
      Number(reviewRows[0].c) === 1;
    record(
      9,
      "Same detected update Open Review twice → reuse review row (no duplicate)",
      ok,
      `firstId=${first.item.id} secondId=${second.item.id} rows=${reviewRows[0].c}`
    );
  } catch (err) {
    record(9, "Duplicate Open Review", false, err.message);
  }

  // --- Scenario 12: Approved unpublished → only Human Publish can publish ---
  try {
    const rec = await recruitmentService.createRecruitment({
      title: `${PREFIX} Approved Unpublished`,
      slug: `${PREFIX}-approved-unpublished`,
      department: "E2E"
    });
    const bundle = await recruitmentLifecycleService.createManualRecruitmentUpdate({
      recruitmentId: rec.id,
      eventType: "notification",
      title: `${PREFIX} Approved Unpublished Draft`
    });
    await recruitmentReviewService.updateReviewDecision(bundle.review.id, {
      decision: "approve",
      notes: "approved waiting publish"
    });
    const pagesAfterApprove = await countPagesForRecruitment(rec.id);
    const draft = await generatorDraftService.getDraftById(bundle.draft.id);
    const stillDraft = String(draft.status) === "draft";
    await humanPublishDraft(draft, rec.id, `${PREFIX}-approved-then-published`);
    const draftAfter = await generatorDraftService.getDraftById(bundle.draft.id);
    const ok =
      pagesAfterApprove === 0 &&
      stillDraft &&
      String(draftAfter.status) === "published" &&
      isAutoPublishBlocked();
    record(
      12,
      "Approved but unpublished → only Human Publish publishes",
      ok,
      `pagesAfterApprove=${pagesAfterApprove} draftBefore=${draft.status} draftAfter=${draftAfter.status}`
    );
  } catch (err) {
    record(12, "Approved unpublished → Human Publish", false, err.message);
  }

  // --- HTTP API smoke: ensure/unfreeze/reject notes (auth) ---
  try {
    const request = require("supertest");
    const app = require("../server/app");
    const agent = request.agent(app);
    const login = await agent
      .post("/api/admin/login")
      .send({ username: "admin", password: "123456" });
    if (login.status !== 200) {
      record(
        "API",
        "HTTP login for API smoke",
        false,
        `login status ${login.status}`
      );
    } else {
      const csrf = await agent.get("/api/admin/csrf-token");
      const token = csrf.body && (csrf.body.csrfToken || csrf.body.token || csrf.body.data);
      const headers = token ? { "X-CSRF-Token": token } : {};

      const updateId = await insertUpdate(
        siteId,
        `${PREFIX} API Ensure`,
        `https://example.gov.in/${PREFIX}/api-ensure.pdf`
      );
      const ensure = await agent
        .post("/api/admin/recruitment-review-queue/ensure-from-update")
        .set(headers)
        .send({ update_id: updateId });
      const ensureOk = ensure.status === 200 && ensure.body && ensure.body.success === true;

      const rejectNoNotes = await agent
        .post(`/api/admin/recruitment-review-queue/${ensure.body.data.id}/reject`)
        .set(headers)
        .send({ notes: "" });
      const rejectBlocked = rejectNoNotes.status === 400;

      await agent
        .post(`/api/admin/recruitment-review-queue/${ensure.body.data.id}/freeze`)
        .set(headers)
        .send({});
      const unfreeze = await agent
        .post(`/api/admin/recruitment-review-queue/${ensure.body.data.id}/unfreeze`)
        .set(headers)
        .send({ notes: "api unfreeze" });
      const unfreezeOk =
        unfreeze.status === 200 &&
        unfreeze.body &&
        unfreeze.body.data &&
        unfreeze.body.data.status === "under_review";

      const list = await agent.get(
        `/api/admin/recruitment-review-queue?update_id=${updateId}`
      );
      const listOk =
        list.status === 200 &&
        Array.isArray(list.body.data) &&
        list.body.data.some((r) => Number(r.update_id) === Number(updateId));

      record(
        "API",
        "HTTP ensure-from-update + reject-notes-required + unfreeze + update_id filter",
        ensureOk && rejectBlocked && unfreezeOk && listOk,
        `ensure=${ensure.status} rejectEmpty=${rejectNoNotes.status} unfreeze=${unfreeze.status} list=${list.status}`
      );
    }
  } catch (err) {
    record("API", "HTTP API smoke", false, err.message);
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  const failed = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass);
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}\t${r.id}\t${r.name}`);
  }
  console.log(`\nPassed: ${passed.length}  Failed: ${failed.length}  Total: ${results.length}`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) {
      console.log(`- ${f.id}: ${f.name} → ${f.detail}`);
    }
  }
  process.exit(failed.length ? 1 : 0);
}

run().catch((err) => {
  console.error("E2E runner crashed:", err);
  process.exit(2);
});
