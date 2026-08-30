/**
 * Workflow IA helpers — presentation only.
 * Clarifies manual vs automatic paths using existing routes/APIs.
 * Does not enable automation, publish, or invent backend actions.
 */
(function () {
  "use strict";

  const WF_VERSION = "2";

  /** Factual page catalog aligned to existing backend capabilities. */
  const PAGES = Object.freeze({
    recruitments: {
      id: "recruitments",
      where: "All Recruitments",
      purpose: "Create and manage recruitment records (organization, exam, year, advertisement, lifecycle).",
      before: "Official vacancy or update discovered (manual), or a matching decision that creates/attaches a parent.",
      here: "New recruitment, edit record, Event Timeline, Manual Update, draft binding, page links.",
      next: "Prepare content in Generator/Drafts, resolve Needs Matching in Review Center, or open Editorial Review.",
      path: "manual",
      currentStep: "recruitment",
      primaryAction: { label: "New recruitment", href: null, targetId: "newRecruitmentBtn" },
      secondaryAction: { label: "Manual update (admit card / result)", href: "#manualUpdateForm" }
    },
    events: {
      id: "events",
      where: "Recruitment Timeline",
      purpose: "Lifecycle events for one selected recruitment (notification → correction → admit card → answer key → result → …).",
      before: "A recruitment record must exist and be selected.",
      here: "View and add events from recruitment_events. This is history for the parent recruitment — not a second recruitment.",
      next: "Create Manual Update or bind a draft for the event, then Review Center / Editorial / Manual Publish.",
      path: "manual",
      currentStep: "events"
    },
    reviewCenter: {
      id: "reviewCenter",
      where: "Review Center",
      purpose: "Operational review queue. Needs Matching is a status filter here — not a separate workspace.",
      before: "A draft/update exists that needs a recruitment decision (automation match or manual update package).",
      here: "Filter by Needs Matching / pending / approved / rejected. Matching associates an item with the correct recruitment.",
      next: "After matching/approval: Editorial Review for content check, then Manual Publish in Generator. Approve ≠ Publish.",
      path: "both",
      currentStep: "matching",
      primaryAction: { label: "Needs Matching filter", href: "/admin/recruitment-review-queue?status=needs_matching" }
    },
    needsMatching: {
      id: "needsMatching",
      where: "Review Center · Needs Matching",
      purpose: "Filtered Review Center state: items that must be linked to the correct recruitment.",
      before: "Same Review Center queue — status filter = needs_matching.",
      here: "Associate the item with the correct recruitment (Attach / Create Parent / Standalone / Reject).",
      next: "Item leaves Needs Matching; continue draft/editorial work, then Manual Publish.",
      path: "both",
      currentStep: "matching"
    },
    drafts: {
      id: "drafts",
      where: "Generator Drafts",
      purpose: "Parked content preparation. A draft is not published and never auto-publishes.",
      before: "Manual Generator save, Manual Update package, or (when automation is on) auto-draft from detection.",
      here: "Open, edit, and prepare structured content. Drafts may exist before a recruitment and can be bound later.",
      next: "Review Center / Editorial Review, then Manual Publish from Generator. Draft ≠ Published.",
      path: "both",
      currentStep: "draft",
      primaryAction: { label: "Open Generator", href: "/generator" }
    },
    generator: {
      id: "generator",
      where: "Page Generator",
      purpose: "Create/edit structured page content and perform the final Manual Publish (POST pages).",
      before: "Source input (PDF/text) or an existing draft.",
      here: "Extract, structure, preview, park draft, and publish manually when ready.",
      next: "Published page appears in Page Manager. Editorial Approve does not publish.",
      path: "manual",
      currentStep: "publish"
    },
    editorial: {
      id: "editorial",
      where: "Editorial Review",
      purpose: "Human editorial check of generated content for a recruitment. Separate from Review Center matching.",
      before: "A draft is attached / ready for editorial workflow.",
      here: "Check accuracy, request changes, approve or reject. Approve ≠ Publish.",
      next: "Manual Publish in Generator, then manage the live page in Page Manager.",
      path: "both",
      currentStep: "editorial",
      primaryAction: { label: "Open Drafts", href: "/generator#drafts" }
    },
    pageManager: {
      id: "pageManager",
      where: "Published Pages",
      purpose: "Manage live/public pages already published. Search, filter, delete/restore — not the create/publish entry point.",
      before: "Manual Publish from Generator created a page row + HTML.",
      here: "Inspect and manage published content. Recruitment linkage is managed on All Recruitments.",
      next: "Return to Generator to publish another page, or Recruitments to attach page links.",
      path: "both",
      currentStep: "published"
    },
    monitoring: {
      id: "monitoring",
      where: "Monitoring — Source Health",
      purpose: "Official source registry and health. Entry for the automatic path when monitoring flags are on.",
      before: "Human-curated official sources configured in ACC Sources / Monitoring.",
      here: "Check source health. Live crawler is gated by safety flags (currently off by default).",
      next: "Detected Updates → (when pipeline on) matching / draft → Review Center. Publishing stays manual.",
      path: "automatic",
      currentStep: "detect"
    },
    monitoringUpdates: {
      id: "monitoringUpdates",
      where: "Monitoring — Detected Updates",
      purpose: "Notices discovered by monitoring. One update maps to one draft when converted.",
      before: "A monitored source check found a change (or a stored update while pipeline is dormant).",
      here: "Inspect detections. With automation off, use manual recruitment/draft paths for content.",
      next: "Review Center (Needs Matching) or Generator Drafts → Editorial → Manual Publish.",
      path: "automatic",
      currentStep: "detect"
    },
    acc: {
      id: "acc",
      where: "Automation Control Center",
      purpose: "Ops overview and safety flags. Snapshots of sources, queue, drafts, reviews — not the primary edit workspaces.",
      before: "—",
      here: "Inspect runtime posture. Deep work stays on Recruitments, Review Center, Drafts, Editorial, Generator.",
      next: "Use dedicated pages for actions. This page does not enable Auto Publish.",
      path: "automatic",
      currentStep: "detect"
    }
  });

  const STEPS_MANUAL = [
    { id: "recruitment", label: "1 Recruitment" },
    { id: "draft", label: "2 Draft" },
    { id: "matching", label: "3 Matching" },
    { id: "review", label: "4 Review" },
    { id: "editorial", label: "5 Editorial" },
    { id: "publish", label: "6 Publish" }
  ];

  const STEPS_AUTO = [
    { id: "detect", label: "1 Detect" },
    { id: "draft", label: "2 Draft" },
    { id: "matching", label: "3 Matching" },
    { id: "review", label: "4 Review" },
    { id: "editorial", label: "5 Editorial" },
    { id: "publish", label: "6 Publish" }
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pathLabel(path) {
    if (path === "manual") return "Manual path";
    if (path === "automatic") return "Automatic path";
    return "Manual + Automatic converge here";
  }

  function stepList(page) {
    const steps = page.path === "automatic" ? STEPS_AUTO : STEPS_MANUAL;
    const current = page.currentStep;
    const order = steps.map((s) => s.id);
    const idx = order.indexOf(current);
    return steps
      .map((step, i) => {
        let cls = "adm-wf-steps__step";
        if (step.id === current) cls += " is-current";
        else if (idx >= 0 && i < idx) cls += " is-done";
        if (step.id === "publish") cls += " is-locked";
        return `<span class="${cls}">${escapeHtml(step.label)}</span>`;
      })
      .join('<span class="adm-wf-steps__arrow" aria-hidden="true">&rarr;</span>');
  }

  function renderContext(pageKey) {
    const page = PAGES[pageKey];
    if (!page) return "";
    const primary = page.primaryAction
      ? page.primaryAction.href
        ? `<a class="header-action-btn adm-wf__action" href="${escapeHtml(page.primaryAction.href)}">${escapeHtml(page.primaryAction.label)}</a>`
        : page.primaryAction.targetId
          ? `<button type="button" class="header-action-btn adm-wf__action" data-adm-wf-click="${escapeHtml(page.primaryAction.targetId)}">${escapeHtml(page.primaryAction.label)}</button>`
          : ""
      : "";
    const secondary = page.secondaryAction
      ? `<a class="header-action-btn rom-secondary adm-wf__action" href="${escapeHtml(page.secondaryAction.href)}">${escapeHtml(page.secondaryAction.label)}</a>`
      : "";

    return `
      <div class="adm-wf__top">
        <div class="adm-wf__identity">
          <p class="adm-wf__eyebrow">Where am I</p>
          <h2 class="adm-wf__title">${escapeHtml(page.where)}</h2>
        </div>
        <div class="adm-wf__badges">
          <span class="adm-wf-badge adm-wf-badge--path" data-adm-wf-path="${escapeHtml(page.path)}">${escapeHtml(pathLabel(page.path))}</span>
          <span class="adm-wf-badge adm-wf-badge--auto is-off" data-adm-wf-auto-badge>Automation: OFF · Manual workflow available</span>
          <span class="adm-wf-badge adm-wf-badge--publish">Publish: MANUAL ONLY</span>
        </div>
      </div>
      <dl class="adm-wf__meta">
        <div><dt>This page</dt><dd>${escapeHtml(page.purpose)}</dd></div>
        <div><dt>Before this</dt><dd>${escapeHtml(page.before)}</dd></div>
        <div><dt>Do here</dt><dd>${escapeHtml(page.here)}</dd></div>
        <div><dt>Next step</dt><dd>${escapeHtml(page.next)}</dd></div>
      </dl>
      <nav class="adm-wf-steps" aria-label="Workflow steps">${stepList(page)}</nav>
      <div class="adm-wf__actions">${primary}${secondary}</div>
    `;
  }

  function hydrateMounts() {
    document.querySelectorAll("[data-adm-wf]").forEach((el) => {
      if (el.dataset.admWfHydrated === "1") return;
      const key = el.getAttribute("data-adm-wf");
      const html = renderContext(key);
      if (!html) return;
      el.innerHTML = html;
      el.dataset.admWfHydrated = "1";
      el.dataset.admWfVersion = WF_VERSION;
    });

    document.querySelectorAll("[data-adm-wf-click]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-adm-wf-click");
        const target = id ? document.getElementById(id) : null;
        if (target) target.click();
      });
    });
  }

  function applyHashWorkspace() {
    const loc = typeof location !== "undefined" ? location : { hash: "" };
    const hash = String(loc.hash || "").replace(/^#/, "");
    const isEvents = hash === "eventTimeline";
    const isDrafts = hash === "drafts";
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.adminHash = hash || "";
    }
    if (typeof document === "undefined" || !document.querySelectorAll) return;
    document.querySelectorAll("[data-adm-wf-for]").forEach((el) => {
      const mode = el.getAttribute("data-adm-wf-for");
      if (mode === "events") el.hidden = !isEvents;
      if (mode === "recruitments") el.hidden = isEvents;
      if (mode === "drafts") el.hidden = !isDrafts;
      if (mode === "generator") el.hidden = isDrafts;
    });
  }

  function applyNeedsMatchingContext() {
    if (typeof window === "undefined" || !window.location) return;
    const params = new URLSearchParams(window.location.search || "");
    const status = String(params.get("status") || "").toLowerCase();
    const isNeeds = status === "needs_matching";
    const review = document.getElementById("admWfReviewCenter");
    const needs = document.getElementById("admWfNeedsMatching");
    if (review) review.hidden = isNeeds;
    if (needs) needs.hidden = !isNeeds;
  }

  async function refreshAutomationBadge() {
    const badges = document.querySelectorAll("[data-adm-wf-auto-badge]");
    if (!badges.length || typeof window.adminSafeFetch !== "function") return;
    try {
      const settingsRes = await window.adminSafeFetch("/api/admin/automation-control-center/settings");
      const flags =
        settingsRes && settingsRes.success && settingsRes.data
          ? settingsRes.data.runtimeFlags || {}
          : {};
      const monitoringOn = flags.PRODUCTION_MONITORING_ENABLED === true;
      const crawlerOn = flags.LIVE_CRAWLER_ENABLED === true;
      const autoOn = monitoringOn || crawlerOn || flags.RECRUITMENT_PIPELINE_ENABLED === true;
      const label = autoOn
        ? "Automation: PARTIAL · Publish still MANUAL"
        : "Automation: OFF · Manual workflow available";
      badges.forEach((el) => {
        el.textContent = label;
        el.classList.toggle("is-off", !autoOn);
        el.classList.toggle("is-partial", !!autoOn);
      });
    } catch (_err) {
      /* keep static OFF copy */
    }
  }

  function init() {
    hydrateMounts();
    applyHashWorkspace();
    applyNeedsMatchingContext();
    refreshAutomationBadge();
    window.addEventListener("hashchange", applyHashWorkspace);
    window.addEventListener("popstate", applyNeedsMatchingContext);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.AdminWorkflowIA = {
    VERSION: WF_VERSION,
    PAGES,
    renderContext,
    hydrate: hydrateMounts
  };
})();
