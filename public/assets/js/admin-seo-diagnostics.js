/**
 * Package 4F — SEO Diagnostics operator panel.
 */
(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function message(text, isError) {
    const el = byId("seoMessage");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
    el.classList.toggle("is-error", Boolean(isError));
  }

  async function api(url, options) {
    const opts = { ...(options || {}) };
    if (opts.body && typeof opts.body !== "string") {
      opts.headers = { ...(opts.headers || {}), "Content-Type": "application/json" };
      opts.body = JSON.stringify(opts.body);
    }
    const response =
      typeof window.fetchAdminWithCsrf === "function"
        ? await window.fetchAdminWithCsrf(url, opts)
        : await fetch(url, { credentials: "include", ...opts });
    if (response.status === 401) {
      window.location.href = "/login?reason=expired";
      throw new Error("Admin session expired");
    }
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || body.success === false) {
      throw new Error(body?.message || `Request failed (${response.status})`);
    }
    return body;
  }

  function renderList(el, rows, mapper) {
    if (!el) return;
    if (!rows || !rows.length) {
      el.innerHTML = "<li class='seo-empty'>None detected</li>";
      return;
    }
    el.innerHTML = rows.slice(0, 40).map(mapper).join("");
  }

  function renderPanel(data) {
    const summary = data.summary || {};
    byId("seoGeneratedAt").textContent = data.generatedAt
      ? `Generated ${data.generatedAt}`
      : "—";
    byId("seoKpiGrid").innerHTML = [
      ["Pages scanned", summary.pagesScanned],
      ["Validation failed", summary.validationFailed],
      ["Missing metadata", summary.missingMetadataCount],
      ["Missing schema", summary.missingSchemaCount],
      ["Missing descriptions", summary.missingDescriptionCount],
      ["Broken links", summary.brokenInternalLinkCount],
      ["Duplicate titles", summary.duplicateTitleCount],
      ["Sitemap OK", summary.sitemapOk ? "Yes" : "No"]
    ]
      .map(
        ([label, value]) =>
          `<div class="seo-kpi"><span class="seo-kpi__label">${escapeHtml(label)}</span><strong>${escapeHtml(
            value == null ? "—" : value
          )}</strong></div>`
      )
      .join("");

    renderList(
      byId("seoMissingMetadata"),
      data.missingMetadata,
      (row) =>
        `<li><strong>${escapeHtml(row.slug || "—")}</strong> — ${escapeHtml(row.label)}<br><small>${escapeHtml(
          row.detail || ""
        )}</small></li>`
    );
    renderList(
      byId("seoMissingSchema"),
      data.missingSchema,
      (row) =>
        `<li><strong>${escapeHtml(row.slug || "—")}</strong> — ${escapeHtml(row.detail || row.label)}</li>`
    );
    renderList(
      byId("seoMissingDescriptions"),
      data.missingDescriptions,
      (row) =>
        `<li><strong>${escapeHtml(row.slug || "—")}</strong> — ${escapeHtml(row.detail || row.label)}</li>`
    );
    renderList(
      byId("seoBrokenLinks"),
      data.brokenInternalLinks,
      (row) =>
        `<li><strong>${escapeHtml(row.slug || "—")}</strong> → ${escapeHtml(row.href || row.slug)}<br><small>${escapeHtml(
          row.detail || ""
        )}</small></li>`
    );
    renderList(
      byId("seoDuplicateTitles"),
      data.duplicateTitles,
      (row) =>
        `<li><strong>${escapeHtml(row.title)}</strong> × ${escapeHtml(row.count)}<br><small>${escapeHtml(
          (row.slugs || []).join(", ")
        )}</small></li>`
    );

    const sitemap = data.sitemap || {};
    byId("seoSitemapSummary").innerHTML = `<p>URLs: ${escapeHtml(
      sitemap.summary?.urlCount ?? "—"
    )} · Missing: ${escapeHtml(sitemap.summary?.missingCount ?? "—")} · Duplicates: ${escapeHtml(
      sitemap.summary?.duplicateCount ?? "—"
    )} · Canonical issues: ${escapeHtml(sitemap.summary?.canonicalIssueCount ?? "—")}</p>`;
    renderList(
      byId("seoSitemapMissing"),
      sitemap.missing,
      (row) =>
        `<li><strong>${escapeHtml(row.path)}</strong> <small>${escapeHtml(row.kind || "")}</small></li>`
    );
  }

  function renderFeatureReport(data) {
    const el = byId("seoFeatureReport");
    if (!el) return;
    const completed = (data.completedPackages || [])
      .map((p) => `<li>${escapeHtml(p.packageCode || p.packageId)} — ${escapeHtml(p.name || p.packageName || "")}</li>`)
      .join("");
    const gaps = (data.remainingGaps || [])
      .map(
        (g) =>
          `<li><strong>${escapeHtml(g.gapId)}</strong> (${escapeHtml(g.priority || "")}) — ${escapeHtml(
            g.title || g.note || g.status || ""
          )}</li>`
      )
      .join("");
    const rec = data.program5ReadinessRecommendation || {};
    el.innerHTML = `
      <p><strong>Verdict:</strong> ${escapeHtml(data.verdict || "—")}</p>
      <p><strong>Program 4 complete:</strong> ${data.program4?.complete ? "Yes" : "No"}</p>
      <p class="seo-disclaimer">${escapeHtml(data.disclaimer || "")}</p>
      <h3>Completed packages</h3>
      <ul>${completed || "<li>None</li>"}</ul>
      <h3>Remaining gaps</h3>
      <ul>${gaps || "<li>None</li>"}</ul>
      <h3>Program 5 recommendation</h3>
      <p>${escapeHtml(rec.recommendation || "—")}</p>
      <p><small>Locked: ${rec.locked ? "yes" : "no"} · Deployment authorized: ${
        rec.deploymentAuthorized ? "yes" : "no"
      }</small></p>`;
  }

  async function loadPanel() {
    try {
      const [panel, report] = await Promise.all([
        api("/api/admin/seo-diagnostics?limit=40"),
        api("/api/admin/seo-diagnostics/feature-completion-report")
      ]);
      renderPanel(panel.data || {});
      renderFeatureReport(report.data || {});
      message("SEO diagnostics refreshed.");
    } catch (err) {
      message(err.message, true);
    }
  }

  async function inspectPage(event) {
    event.preventDefault();
    const slug = String(byId("seoPageSlug").value || "")
      .trim()
      .replace(/^\//, "")
      .replace(/\.html$/i, "");
    if (!slug) return;
    const host = byId("seoPageResults");
    host.innerHTML = "<p>Loading…</p>";
    try {
      const [diagnostics, checklist, freshness, links, validation] = await Promise.all([
        api(`/api/admin/seo-diagnostics/page/${encodeURIComponent(slug)}`),
        api(`/api/admin/seo-pipeline/pages/${encodeURIComponent(slug)}/editorial-checklist`),
        api(`/api/admin/seo-pipeline/pages/${encodeURIComponent(slug)}/freshness`),
        api(`/api/admin/seo-pipeline/pages/${encodeURIComponent(slug)}/link-suggestions`),
        api(`/api/admin/seo-pipeline/pages/${encodeURIComponent(slug)}/validation`)
      ]);
      const d = diagnostics.data || {};
      const c = checklist.data?.checklist || {};
      const f = freshness.data?.freshness || {};
      const s = links.data?.suggestions || {};
      const v = validation.data?.validation || {};
      host.innerHTML = `
        <div class="seo-page-block">
          <h3>Validation summary</h3>
          <p>${escapeHtml(v.passed ?? 0)}/${escapeHtml(v.total ?? 0)} passed (advisory)</p>
        </div>
        <div class="seo-page-block">
          <h3>Editorial checklist</h3>
          <p>${escapeHtml(c.progressLabel || "—")}</p>
          <ul>${(c.items || [])
            .map(
              (item) =>
                `<li>${item.ok ? "✓" : "○"} ${escapeHtml(item.label)} — <small>${escapeHtml(
                  item.detail || ""
                )}</small></li>`
            )
            .join("")}</ul>
        </div>
        <div class="seo-page-block">
          <h3>Freshness</h3>
          <p>Created ${escapeHtml(f.createdDate || "—")} · Updated ${escapeHtml(
            f.updatedDate || "—"
          )} · Last review ${escapeHtml(f.lastReviewDate || "—")} · Status ${escapeHtml(
            f.freshnessLabel || "—"
          )}</p>
        </div>
        <div class="seo-page-block">
          <h3>Internal linking suggestions</h3>
          <p><small>${escapeHtml(links.data?.note || "Suggestions only")}</small></p>
          <ul>
            ${(s.relatedDepartments || [])
              .map((row) => `<li>Department: ${escapeHtml(row.label)} → ${escapeHtml(row.href)}</li>`)
              .join("")}
            ${(s.relatedQualifications || [])
              .map((row) => `<li>Qualification: ${escapeHtml(row.label)} → ${escapeHtml(row.href)}</li>`)
              .join("")}
            ${(s.relatedStates || [])
              .map((row) => `<li>State: ${escapeHtml(row.label)} → ${escapeHtml(row.href)}</li>`)
              .join("")}
            ${(s.relatedTopics || [])
              .map((row) => `<li>Topic: ${escapeHtml(row.label)} → ${escapeHtml(row.href)}</li>`)
              .join("")}
            ${(s.relatedRecruitments || [])
              .map((row) => `<li>Recruitment: ${escapeHtml(row.title)} → ${escapeHtml(row.href || "")}</li>`)
              .join("")}
          </ul>
        </div>
        <div class="seo-page-block">
          <h3>Page diagnostics</h3>
          <p>Missing metadata: ${escapeHtml((d.missingMetadata || []).length)} · Broken links: ${escapeHtml(
            (d.brokenInternalLinks || []).length
          )}</p>
        </div>`;
      message(`Inspected /${slug}.`);
    } catch (err) {
      host.innerHTML = "";
      message(err.message, true);
    }
  }

  async function markReviewed() {
    const slug = String(byId("seoPageSlug").value || "")
      .trim()
      .replace(/^\//, "")
      .replace(/\.html$/i, "");
    if (!slug) {
      message("Enter a page slug first.", true);
      return;
    }
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api(`/api/admin/seo-pipeline/pages/${encodeURIComponent(slug)}/review`, {
        method: "POST",
        body: { lastReviewDate: today }
      });
      message(`Recorded review date ${today} for /${slug}.`);
      byId("seoPageForm").requestSubmit();
    } catch (err) {
      message(err.message, true);
    }
  }

  byId("seoRefreshBtn")?.addEventListener("click", loadPanel);
  byId("seoPageForm")?.addEventListener("submit", inspectPage);
  byId("seoMarkReviewedBtn")?.addEventListener("click", markReviewed);
  loadPanel();
})();
