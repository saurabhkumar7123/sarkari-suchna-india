(function () {
  let overviewMeta = { allowedBadgeCodes: ["NEW", "OUT", "START", "SOON"], maxBadgesPerPage: 2 };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatBadges(badges) {
    if (!Array.isArray(badges) || !badges.length) return "—";
    return badges.map((b) => escapeHtml(b)).join(", ");
  }

  function generatorEditLink(slug) {
    const s = encodeURIComponent(String(slug || "").replace(/^\/+/, ""));
    return `/generator?slug=${s}`;
  }

  function normalizeSlugInput(raw) {
    return String(raw || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\.html$/i, "");
  }

  function skeletonHtml() {
    return `<div class="page-table page-table--skeleton" aria-hidden="true">
      <div class="page-head"><div>Title</div><div>Details</div><div>Actions</div></div>
      ${Array.from({ length: 3 })
        .map(() => '<div class="page-row skeleton-row"><div></div><div></div><div></div></div>')
        .join("")}
    </div>`;
  }

  function renderTable(hostId, headCols, rowsHtml, emptyMessage) {
    const host = document.getElementById(hostId);
    if (!host) return;
    if (!rowsHtml) {
      host.innerHTML = `<p class="manager-hint">${escapeHtml(emptyMessage)}</p>`;
      return;
    }
    host.innerHTML = `
      <div class="page-table">
        <div class="page-head">${headCols.map((c) => `<div>${escapeHtml(c)}</div>`).join("")}</div>
        ${rowsHtml}
      </div>`;
  }

  function notifyError(message) {
    window.AdminUI?.toastError?.(message);
  }

  function notifySuccess(message) {
    window.AdminUI?.toastSuccess?.(message);
  }

  async function patchPlacement(url, body) {
    const res = await window.adminSafeFetch(url, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    if (!res || !res.success) {
      const msg = (res && res.message) || "Update failed.";
      notifyError(msg);
      return false;
    }
    notifySuccess("Saved");
    return true;
  }

  function badgeCheckboxesHtml(prefix, selected) {
    const codes = overviewMeta.allowedBadgeCodes || [];
    const selectedSet = new Set(Array.isArray(selected) ? selected : []);
    return codes
      .map(
        (code) => `<label style="margin-right:10px;">
          <input type="checkbox" name="${escapeHtml(prefix)}-badge" value="${escapeHtml(code)}"${
          selectedSet.has(code) ? " checked" : ""
        }> ${escapeHtml(code)}
        </label>`
      )
      .join("");
  }

  function readBadgeSelections(container) {
    const codes = overviewMeta.allowedBadgeCodes || [];
    const max = overviewMeta.maxBadgesPerPage || 2;
    const selected = [];
    codes.forEach((code) => {
      const input = container.querySelector(`input[value="${code}"]`);
      if (input && input.checked) selected.push(code);
    });
    return selected.slice(0, max);
  }

  function wireBadgeCheckboxLimit(container) {
    const max = overviewMeta.maxBadgesPerPage || 2;
    container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener("change", () => {
        const checked = container.querySelectorAll('input[type="checkbox"]:checked');
        if (checked.length > max) {
          input.checked = false;
          notifyError(`Maximum ${max} badges per page`);
        }
      });
    });
  }

  function renderBreakingList(items) {
    if (!items.length) {
      renderTable("breakingList", [], "", "No pages are currently flagged for Breaking News.");
    } else {
      const rows = items
        .map((item, index) => {
          const onHomepage = index < 10;
          const visibility = onHomepage ? "On homepage ticker" : "Flagged only (beyond ticker limit)";
          return `<div class="page-row" data-breaking-slug="${escapeHtml(item.slug)}">
          <div>${escapeHtml(item.title)}</div>
          <div>
            <div><strong>Order:</strong>
              <input type="number" min="0" step="1" class="breaking-order-input" value="${escapeHtml(item.breakingOrder)}" style="width:72px;margin-left:4px;">
              · <strong>Status:</strong> ${escapeHtml(item.status || "—")}
            </div>
            <div><strong>Slug:</strong> ${escapeHtml(item.slug)} · ${escapeHtml(visibility)}</div>
            <div><strong>Badges:</strong> ${formatBadges(item.badges)}</div>
          </div>
          <div class="row-actions">
            <button type="button" class="header-action-btn breaking-save-order">Save order</button>
            <button type="button" class="header-action-btn breaking-remove">Remove</button>
            <a href="${generatorEditLink(item.slug)}">Edit in Generator</a>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">View</a>
          </div>
        </div>`;
        })
        .join("");
      renderTable("breakingList", ["Title", "Details", "Actions"], rows, "");
    }

    const addHost = document.getElementById("breakingAddForm");
    if (addHost) {
      addHost.innerHTML = `
        <p class="manager-hint" style="margin-bottom:8px;"><strong>Add page to Breaking</strong></p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
          <input type="text" id="breakingAddSlug" placeholder="page-slug" aria-label="Page slug" style="min-width:220px;">
          <label>Order <input type="number" id="breakingAddOrder" min="0" step="1" value="0" style="width:72px;"></label>
          <button type="button" class="header-action-btn" id="breakingAddBtn">Add to Breaking</button>
        </div>`;
    }

    document.querySelectorAll(".breaking-save-order").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-breaking-slug]");
        if (!row) return;
        const slug = row.getAttribute("data-breaking-slug");
        const orderInput = row.querySelector(".breaking-order-input");
        const breakingOrder = Math.max(0, parseInt(orderInput?.value, 10) || 0);
        const ok = await patchPlacement(`/api/admin/homepage-management/breaking/${encodeURIComponent(slug)}`, {
          breaking: true,
          breakingOrder
        });
        if (ok) loadOverview();
      });
    });

    document.querySelectorAll(".breaking-remove").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-breaking-slug]");
        if (!row) return;
        const slug = row.getAttribute("data-breaking-slug");
        if (!window.confirm(`Remove "${slug}" from Breaking News?`)) return;
        const ok = await patchPlacement(`/api/admin/homepage-management/breaking/${encodeURIComponent(slug)}`, {
          breaking: false,
          breakingOrder: 0
        });
        if (ok) loadOverview();
      });
    });

    document.getElementById("breakingAddBtn")?.addEventListener("click", async () => {
      const slug = normalizeSlugInput(document.getElementById("breakingAddSlug")?.value);
      const breakingOrder = Math.max(0, parseInt(document.getElementById("breakingAddOrder")?.value, 10) || 0);
      if (!slug) {
        notifyError("Enter a page slug");
        return;
      }
      const ok = await patchPlacement(`/api/admin/homepage-management/breaking/${encodeURIComponent(slug)}`, {
        breaking: true,
        breakingOrder
      });
      if (ok) loadOverview();
    });
  }

  function renderBadgesList(items) {
    if (!items.length) {
      renderTable("badgesList", [], "", "No pages currently have homepage badges.");
    } else {
      const rows = items
        .map(
          (item) => `<div class="page-row" data-badge-slug="${escapeHtml(item.slug)}">
          <div>${escapeHtml(item.title)}</div>
          <div>
            <div class="badge-edit-row">${badgeCheckboxesHtml(`row-${item.slug}`, item.badges)}</div>
            <div><strong>Status:</strong> ${escapeHtml(item.status || "—")} · <strong>Slug:</strong> ${escapeHtml(item.slug)}</div>
          </div>
          <div class="row-actions">
            <button type="button" class="header-action-btn badge-save">Save badges</button>
            <button type="button" class="header-action-btn badge-clear">Remove all</button>
            <a href="${generatorEditLink(item.slug)}">Edit in Generator</a>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">View</a>
          </div>
        </div>`
        )
        .join("");
      renderTable("badgesList", ["Title", "Details", "Actions"], rows, "");
    }

    document.querySelectorAll("[data-badge-slug] .badge-edit-row").forEach((container) => {
      wireBadgeCheckboxLimit(container);
    });

    document.querySelectorAll(".badge-save").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-badge-slug]");
        if (!row) return;
        const slug = row.getAttribute("data-badge-slug");
        const container = row.querySelector(".badge-edit-row");
        const badges = readBadgeSelections(container);
        const ok = await patchPlacement(`/api/admin/homepage-management/badges/${encodeURIComponent(slug)}`, { badges });
        if (ok) loadOverview();
      });
    });

    document.querySelectorAll(".badge-clear").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-badge-slug]");
        if (!row) return;
        const slug = row.getAttribute("data-badge-slug");
        if (!window.confirm(`Remove all badges from "${slug}"?`)) return;
        const ok = await patchPlacement(`/api/admin/homepage-management/badges/${encodeURIComponent(slug)}`, { badges: [] });
        if (ok) loadOverview();
      });
    });

    const addHost = document.getElementById("badgesAddForm");
    if (addHost) {
      addHost.innerHTML = `
        <p class="manager-hint" style="margin-bottom:8px;"><strong>Add badges to a page</strong></p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="text" id="badgesAddSlug" placeholder="page-slug" aria-label="Page slug" style="min-width:220px;">
        </div>
        <div class="badge-edit-row" id="badgesAddChecks">${badgeCheckboxesHtml("add", [])}</div>
        <button type="button" class="header-action-btn" id="badgesAddBtn" style="margin-top:8px;">Save badges</button>`;
      const addChecks = document.getElementById("badgesAddChecks");
      if (addChecks) wireBadgeCheckboxLimit(addChecks);
    }

    document.getElementById("badgesAddBtn")?.addEventListener("click", async () => {
      const slug = normalizeSlugInput(document.getElementById("badgesAddSlug")?.value);
      const container = document.getElementById("badgesAddChecks");
      const badges = container ? readBadgeSelections(container) : [];
      if (!slug) {
        notifyError("Enter a page slug");
        return;
      }
      const ok = await patchPlacement(`/api/admin/homepage-management/badges/${encodeURIComponent(slug)}`, { badges });
      if (ok) loadOverview();
    });
  }

  function renderSmallBoxesList(items) {
    const slots = [1, 2, 3, 4];
    const bySlot = {};
    (items || []).forEach((row) => {
      if (row && row.slot != null) bySlot[String(row.slot)] = row;
    });
    const rows = slots
      .map((slot) => {
        const row = bySlot[String(slot)];
        const title = row ? row.title || row.slug : "Empty";
        const slug = row ? row.slug : "";
        const assignControls = `
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px;">
            <input type="text" class="smallbox-slug-input" data-slot="${slot}" placeholder="page-slug" aria-label="Slug for slot ${slot}" style="min-width:160px;">
            <button type="button" class="header-action-btn smallbox-assign" data-slot="${slot}">Assign</button>
            ${
              slug
                ? `<button type="button" class="header-action-btn smallbox-clear" data-slug="${escapeHtml(slug)}">Clear slot</button>`
                : ""
            }
          </div>`;
        const actions = row
          ? `<a href="${generatorEditLink(slug)}">Edit in Generator</a>
             <a href="/${escapeHtml(slug)}" target="_blank" rel="noopener">View</a>
             ${assignControls}`
          : `<span class="manager-hint">Unassigned</span>${assignControls}`;
        return `<div class="page-row">
          <div>Slot ${slot}${slot === 4 ? " (desktop only)" : ""}</div>
          <div>${escapeHtml(title)}${slug ? ` · <strong>Slug:</strong> ${escapeHtml(slug)}` : ""}</div>
          <div class="row-actions">${actions}</div>
        </div>`;
      })
      .join("");
    renderTable("smallBoxesList", ["Slot", "Occupant", "Actions"], rows, "");

    document.querySelectorAll(".smallbox-assign").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const slot = btn.getAttribute("data-slot");
        const input = document.querySelector(`.smallbox-slug-input[data-slot="${slot}"]`);
        const slug = normalizeSlugInput(input?.value);
        if (!slug) {
          notifyError("Enter a page slug");
          return;
        }
        const ok = await patchPlacement(`/api/admin/homepage-management/small-box/${encodeURIComponent(slug)}`, {
          smallBoxSlot: Number(slot)
        });
        if (ok) loadOverview();
      });
    });

    document.querySelectorAll(".smallbox-clear").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const slug = btn.getAttribute("data-slug");
        if (!slug || !window.confirm(`Clear small box slot for "${slug}"?`)) return;
        const ok = await patchPlacement(`/api/admin/homepage-management/small-box/${encodeURIComponent(slug)}`, {
          smallBoxSlot: null
        });
        if (ok) loadOverview();
      });
    });
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  async function loadOverview() {
    ["breakingList", "badgesList", "smallBoxesList"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = skeletonHtml();
    });

    const res = await window.adminSafeFetch("/api/admin/homepage-management");
    if (!res || !res.success || !res.data) {
      const msg = (res && res.message) || "Could not load homepage management data.";
      ["breakingList", "badgesList", "smallBoxesList"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<p class="dashboard-error">${escapeHtml(msg)}</p>`;
      });
      return;
    }

    const { breaking = [], badges = [], smallBoxes = [], meta = {} } = res.data;
    overviewMeta = {
      allowedBadgeCodes: meta.allowedBadgeCodes || overviewMeta.allowedBadgeCodes,
      maxBadgesPerPage: meta.maxBadgesPerPage || overviewMeta.maxBadgesPerPage
    };

    renderBreakingList(breaking);
    renderBadgesList(badges);
    renderSmallBoxesList(smallBoxes);

    setText(
      "homepageMgmtMeta",
      "Placement updates save directly to the database — no Generator publish required."
    );
    setText(
      "breakingMeta",
      `${meta.breakingTotal || 0} flagged · ${meta.breakingOnHomepage || 0} on homepage ticker (max ${meta.homepageTickerLimit || 10})${
        meta.breakingOverflow ? ` · ${meta.breakingOverflow} beyond ticker` : ""
      }`
    );
    setText("badgesMeta", `${meta.badgePagesTotal || 0} pages with badges · max ${overviewMeta.maxBadgesPerPage} per page`);
    setText("smallBoxesMeta", `${meta.smallBoxSlotsTotal || 0} occupied slots · assigning displaces the previous occupant`);
  }

  document.getElementById("homepageMgmtRefreshBtn")?.addEventListener("click", loadOverview);
  loadOverview();
})();
