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

  function pageSearchFieldHtml(idPrefix) {
    return `<div class="hp-page-search" data-picker-root="${escapeHtml(idPrefix)}">
      <div class="hp-page-search__box">
        <input type="search" id="${escapeHtml(idPrefix)}Query" class="hp-page-search__input" placeholder="Search by page title…" autocomplete="off" aria-label="Search page by title" aria-controls="${escapeHtml(idPrefix)}Suggestions" aria-expanded="false">
        <input type="hidden" id="${escapeHtml(idPrefix)}Slug" value="">
        <ul id="${escapeHtml(idPrefix)}Suggestions" class="hp-page-search__suggestions" role="listbox" hidden></ul>
      </div>
      <p class="hp-page-search__hint" id="${escapeHtml(idPrefix)}Hint">Type at least 2 characters, then select a page.</p>
    </div>`;
  }

  function wirePageSearchPicker(idPrefix) {
    const queryEl = document.getElementById(`${idPrefix}Query`);
    const slugEl = document.getElementById(`${idPrefix}Slug`);
    const suggestEl = document.getElementById(`${idPrefix}Suggestions`);
    const hintEl = document.getElementById(`${idPrefix}Hint`);
    const rootEl = document.querySelector(`[data-picker-root="${idPrefix}"]`);
    if (!queryEl || !slugEl || !suggestEl) {
      return {
        getSelectedSlug: () => "",
        clear: () => {}
      };
    }

    let debounceTimer = null;
    let items = [];

    function setHint(text, isError) {
      if (!hintEl) return;
      hintEl.textContent = text;
      hintEl.classList.toggle("hp-page-search__hint--error", Boolean(isError));
    }

    function closeSuggestions() {
      suggestEl.hidden = true;
      suggestEl.innerHTML = "";
      queryEl.setAttribute("aria-expanded", "false");
    }

    function selectPage(page) {
      if (!page || !page.slug) return;
      slugEl.value = String(page.slug);
      queryEl.value = String(page.title || page.slug);
      setHint(`Selected: ${page.title || page.slug}`, false);
      closeSuggestions();
    }

    function renderSuggestions(list) {
      items = list;
      if (!list.length) {
        suggestEl.innerHTML = `<li class="hp-page-search__empty" role="presentation">No pages found</li>`;
        suggestEl.hidden = false;
        queryEl.setAttribute("aria-expanded", "true");
        return;
      }
      suggestEl.innerHTML = list
        .map(
          (p, i) => `<li role="presentation">
            <button type="button" class="hp-page-search__option" role="option" data-index="${i}">
              <span class="hp-page-search__option-title">${escapeHtml(p.title || p.slug)}</span>
              <span class="hp-page-search__option-meta">${escapeHtml(p.slug || "")}${p.status ? ` · ${escapeHtml(p.status)}` : ""}</span>
            </button>
          </li>`
        )
        .join("");
      suggestEl.hidden = false;
      queryEl.setAttribute("aria-expanded", "true");
    }

    queryEl.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      slugEl.value = "";
      const q = queryEl.value.trim();
      if (q.length < 2) {
        closeSuggestions();
        setHint("Type at least 2 characters, then select a page.", false);
        return;
      }
      setHint("Searching…", false);
      debounceTimer = setTimeout(async () => {
        const res = await window.adminSafeFetch(
          `/api/admin/pages?q=${encodeURIComponent(q)}&page=1&limit=12&sort=desc`
        );
        if (!res || !res.success || !Array.isArray(res.data)) {
          renderSuggestions([]);
          setHint("Search failed. Try again.", true);
          return;
        }
        renderSuggestions(res.data);
        setHint(res.data.length ? "Pick a page from the list." : "No pages found for this title.", !res.data.length);
      }, 280);
    });

    suggestEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".hp-page-search__option");
      if (!btn) return;
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      if (items[idx]) selectPage(items[idx]);
    });

    queryEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSuggestions();
    });

    document.addEventListener("click", (e) => {
      if (rootEl && !rootEl.contains(e.target)) closeSuggestions();
    });

    return {
      getSelectedSlug: () => normalizeSlugInput(slugEl.value),
      clear: () => {
        slugEl.value = "";
        queryEl.value = "";
        closeSuggestions();
        setHint("Type at least 2 characters, then select a page.", false);
      }
    };
  }

  function skeletonHtml() {
    return `<div class="page-table page-table--cols-3 page-table--skeleton" aria-hidden="true">
      <div class="page-head"><div>Title</div><div>Details</div><div>Actions</div></div>
      ${Array.from({ length: 3 })
        .map(() => '<div class="page-row skeleton-row"><div></div><div></div><div></div></div>')
        .join("")}
    </div>`;
  }

  function slotSkeletonHtml() {
    return `<div class="hp-slot-grid" aria-hidden="true">
      ${[1, 2, 3, 4]
        .map(
          () => `<div class="hp-slot-card hp-slot-card--empty">
            <div class="skeleton-row"><div style="min-height:14px;width:40%;"></div></div>
            <div class="skeleton-row"><div style="min-height:18px;width:70%;"></div></div>
          </div>`
        )
        .join("")}
    </div>`;
  }

  function emptyStateHtml(icon, title, hint) {
    return `<div class="hp-empty-state">
      <div class="hp-empty-state__icon" aria-hidden="true">${escapeHtml(icon)}</div>
      <p class="hp-empty-state__title">${escapeHtml(title)}</p>
      <p class="hp-empty-state__hint">${escapeHtml(hint)}</p>
    </div>`;
  }

  function renderTable(hostId, headCols, rowsHtml, emptyConfig) {
    const host = document.getElementById(hostId);
    if (!host) return;
    if (!rowsHtml) {
      host.innerHTML = emptyStateHtml(emptyConfig.icon, emptyConfig.title, emptyConfig.hint);
      return;
    }
    host.innerHTML = `
      <div class="page-table page-table--cols-3">
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

  async function withSaveLoading(button, action, loadingText) {
    if (window.AdminUI?.withLoading && button) {
      return window.AdminUI.withLoading(button, action, loadingText || "Saving...");
    }
    return action();
  }

  async function patchPlacement(url, body, successMessage) {
    const res = await window.adminSafeFetch(url, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    if (!res || !res.success) {
      const msg = (res && res.message) || "Update failed.";
      notifyError(msg);
      return false;
    }
    notifySuccess(successMessage || "Saved");
    return true;
  }

  function badgeCheckboxesHtml(prefix, selected) {
    const codes = overviewMeta.allowedBadgeCodes || [];
    const selectedSet = new Set(Array.isArray(selected) ? selected : []);
    return codes
      .map(
        (code) => `<label>
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

  function statusChip(type, label) {
    return `<span class="hp-status-chip hp-status-chip--${escapeHtml(type)}">${escapeHtml(label)}</span>`;
  }

  function renderBreakingAddForm() {
    const addHost = document.getElementById("breakingAddForm");
    if (!addHost) return;
    addHost.innerHTML = `
      <p class="homepage-mgmt-form__title">Add page to Breaking</p>
      <div class="homepage-mgmt-form__row homepage-mgmt-form__row--search">
        ${pageSearchFieldHtml("breakingAdd")}
        <label class="homepage-mgmt-form__label-inline">Order
          <input type="number" id="breakingAddOrder" min="0" step="1" value="0">
        </label>
        <button type="button" class="header-action-btn header-action-btn--primary" id="breakingAddBtn">Add to Breaking</button>
      </div>`;
  }

  function renderBadgesAddForm() {
    const addHost = document.getElementById("badgesAddForm");
    if (!addHost) return;
    addHost.innerHTML = `
      <p class="homepage-mgmt-form__title">Add badges to a page</p>
      <div class="homepage-mgmt-form__row homepage-mgmt-form__row--search">
        ${pageSearchFieldHtml("badgesAdd")}
      </div>
      <div class="badge-edit-row" id="badgesAddChecks">${badgeCheckboxesHtml("add", [])}</div>
      <button type="button" class="header-action-btn header-action-btn--primary" id="badgesAddBtn">Save badges</button>`;
    const addChecks = document.getElementById("badgesAddChecks");
    if (addChecks) wireBadgeCheckboxLimit(addChecks);
  }

  function renderSmallBoxesAssignForm() {
    const host = document.getElementById("smallBoxesAssignForm");
    if (!host) return;
    const slots = [1, 2, 3, 4];
    host.innerHTML = `
      <p class="homepage-mgmt-form__title">Assign pages to slots</p>
      <div class="homepage-mgmt-assign-grid">
        ${slots
          .map(
            (slot) => `<div class="homepage-mgmt-assign-row">
            <span class="homepage-mgmt-assign-label">Slot ${slot}${slot === 4 ? " (desktop only)" : ""}</span>
            ${pageSearchFieldHtml(`smallboxSlot${slot}`)}
            <button type="button" class="header-action-btn header-action-btn--primary smallbox-assign" data-slot="${slot}">Assign</button>
          </div>`
          )
          .join("")}
      </div>`;
  }

  function wireBreakingActions() {
    const breakingPicker = wirePageSearchPicker("breakingAdd");

    document.querySelectorAll(".breaking-save-order").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-breaking-slug]");
        if (!row) return;
        const slug = row.getAttribute("data-breaking-slug");
        const orderInput = row.querySelector(".breaking-order-input");
        const breakingOrder = Math.max(0, parseInt(orderInput?.value, 10) || 0);
        await withSaveLoading(btn, async () => {
          const ok = await patchPlacement(
            `/api/admin/homepage-management/breaking/${encodeURIComponent(slug)}`,
            { breaking: true, breakingOrder },
            "Breaking order updated"
          );
          if (ok) loadOverview();
        }, "Saving...");
      });
    });

    document.querySelectorAll(".breaking-remove").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-breaking-slug]");
        if (!row) return;
        const slug = row.getAttribute("data-breaking-slug");
        if (!window.confirm(`Remove "${slug}" from Breaking News?`)) return;
        await withSaveLoading(btn, async () => {
          const ok = await patchPlacement(
            `/api/admin/homepage-management/breaking/${encodeURIComponent(slug)}`,
            { breaking: false, breakingOrder: 0 },
            "Removed from Breaking News"
          );
          if (ok) loadOverview();
        }, "Removing...");
      });
    });

    document.getElementById("breakingAddBtn")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const slug = breakingPicker.getSelectedSlug();
      const breakingOrder = Math.max(0, parseInt(document.getElementById("breakingAddOrder")?.value, 10) || 0);
      if (!slug) {
        notifyError("Search by title and select a page from the list");
        return;
      }
      await withSaveLoading(btn, async () => {
        const ok = await patchPlacement(
          `/api/admin/homepage-management/breaking/${encodeURIComponent(slug)}`,
          { breaking: true, breakingOrder },
          "Added to Breaking News"
        );
        if (ok) {
          breakingPicker.clear();
          loadOverview();
        }
      }, "Adding...");
    });
  }

  function wireBadgesActions() {
    const badgesPicker = wirePageSearchPicker("badgesAdd");

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
        await withSaveLoading(btn, async () => {
          const ok = await patchPlacement(
            `/api/admin/homepage-management/badges/${encodeURIComponent(slug)}`,
            { badges },
            "Badges saved"
          );
          if (ok) loadOverview();
        }, "Saving...");
      });
    });

    document.querySelectorAll(".badge-clear").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = btn.closest("[data-badge-slug]");
        if (!row) return;
        const slug = row.getAttribute("data-badge-slug");
        if (!window.confirm(`Remove all badges from "${slug}"?`)) return;
        await withSaveLoading(btn, async () => {
          const ok = await patchPlacement(
            `/api/admin/homepage-management/badges/${encodeURIComponent(slug)}`,
            { badges: [] },
            "Badges cleared"
          );
          if (ok) loadOverview();
        }, "Removing...");
      });
    });

    document.getElementById("badgesAddBtn")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const slug = badgesPicker.getSelectedSlug();
      const container = document.getElementById("badgesAddChecks");
      const badges = container ? readBadgeSelections(container) : [];
      if (!slug) {
        notifyError("Search by title and select a page from the list");
        return;
      }
      await withSaveLoading(btn, async () => {
        const ok = await patchPlacement(
          `/api/admin/homepage-management/badges/${encodeURIComponent(slug)}`,
          { badges },
          "Badges saved"
        );
        if (ok) {
          badgesPicker.clear();
          loadOverview();
        }
      }, "Saving...");
    });
  }

  function wireSmallBoxesActions() {
    const slotPickers = {
      1: wirePageSearchPicker("smallboxSlot1"),
      2: wirePageSearchPicker("smallboxSlot2"),
      3: wirePageSearchPicker("smallboxSlot3"),
      4: wirePageSearchPicker("smallboxSlot4")
    };

    document.querySelectorAll(".smallbox-assign").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const slot = btn.getAttribute("data-slot");
        const picker = slotPickers[slot];
        const slug = picker ? picker.getSelectedSlug() : "";
        if (!slug) {
          notifyError("Search by title and select a page from the list");
          return;
        }
        await withSaveLoading(btn, async () => {
          const ok = await patchPlacement(
            `/api/admin/homepage-management/small-box/${encodeURIComponent(slug)}`,
            { smallBoxSlot: Number(slot) },
            "Slot assigned"
          );
          if (ok) {
            picker.clear();
            loadOverview();
          }
        }, "Assigning...");
      });
    });

    document.querySelectorAll(".smallbox-clear").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const slug = btn.getAttribute("data-slug");
        if (!slug || !window.confirm(`Clear small box slot for "${slug}"?`)) return;
        await withSaveLoading(btn, async () => {
          const ok = await patchPlacement(
            `/api/admin/homepage-management/small-box/${encodeURIComponent(slug)}`,
            { smallBoxSlot: null },
            "Slot cleared"
          );
          if (ok) loadOverview();
        }, "Clearing...");
      });
    });
  }

  function renderBreakingList(items) {
    renderBreakingAddForm();

    if (!items.length) {
      renderTable("breakingList", [], "", {
        icon: "📰",
        title: "No Breaking News pages yet",
        hint: "Search by page title above and add it to the homepage ticker."
      });
    } else {
      const rows = items
        .map((item, index) => {
          const onHomepage = index < 10;
          const chip = onHomepage ? statusChip("ticker", "Ticker") : statusChip("overflow", "Overflow");
          return `<div class="page-row" data-breaking-slug="${escapeHtml(item.slug)}">
          <div>${escapeHtml(item.title)}</div>
          <div>
            <div class="row-detail-line">${chip}<strong>Order:</strong>
              <input type="number" min="0" step="1" class="breaking-order-input" value="${escapeHtml(item.breakingOrder)}">
              · <strong>Status:</strong> ${escapeHtml(item.status || "—")}
            </div>
            <div class="row-detail-line"><strong>Slug:</strong> ${escapeHtml(item.slug)}</div>
            <div class="row-detail-line"><strong>Badges:</strong> ${formatBadges(item.badges)}</div>
          </div>
          <div class="row-actions">
            <button type="button" class="header-action-btn header-action-btn--primary breaking-save-order">Save order</button>
            <button type="button" class="header-action-btn header-action-btn--danger breaking-remove">Remove</button>
            <a href="${generatorEditLink(item.slug)}">Edit in Generator</a>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">View</a>
          </div>
        </div>`;
        })
        .join("");
      renderTable("breakingList", ["Title", "Details", "Actions"], rows, {});
    }

    wireBreakingActions();
  }

  function renderBadgesList(items) {
    renderBadgesAddForm();

    if (!items.length) {
      renderTable("badgesList", [], "", {
        icon: "🏷",
        title: "No badge pages yet",
        hint: "Search by page title above and choose up to two homepage badges."
      });
    } else {
      const rows = items
        .map(
          (item) => `<div class="page-row" data-badge-slug="${escapeHtml(item.slug)}">
          <div>${escapeHtml(item.title)}</div>
          <div>
            <div class="badge-edit-row">${badgeCheckboxesHtml(`row-${item.slug}`, item.badges)}</div>
            <div class="row-detail-line"><strong>Status:</strong> ${escapeHtml(item.status || "—")} · <strong>Slug:</strong> ${escapeHtml(item.slug)}</div>
          </div>
          <div class="row-actions">
            <button type="button" class="header-action-btn header-action-btn--primary badge-save">Save badges</button>
            <button type="button" class="header-action-btn header-action-btn--danger badge-clear">Remove all</button>
            <a href="${generatorEditLink(item.slug)}">Edit in Generator</a>
            <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">View</a>
          </div>
        </div>`
        )
        .join("");
      renderTable("badgesList", ["Title", "Details", "Actions"], rows, {});
    }

    wireBadgesActions();
  }

  function renderSmallBoxesList(items) {
    renderSmallBoxesAssignForm();

    const host = document.getElementById("smallBoxesList");
    if (!host) return;

    const slots = [1, 2, 3, 4];
    const bySlot = {};
    (items || []).forEach((row) => {
      if (row && row.slot != null) bySlot[String(row.slot)] = row;
    });

    host.innerHTML = `<div class="hp-slot-grid">${slots
      .map((slot) => {
        const row = bySlot[String(slot)];
        const slug = row ? row.slug : "";
        const title = row ? row.title || row.slug : "";
        const filled = Boolean(slug);
        const chip = filled ? statusChip("filled", "Filled") : statusChip("empty", "Empty");
        const slotLabel = `Slot ${slot}`;
        const desktopNote = slot === 4 ? '<span class="hp-slot-card__label-note">Desktop only</span>' : "";
        const body = filled
          ? `<p class="hp-slot-card__title">${escapeHtml(title)}</p>
             <p class="hp-slot-card__slug">${escapeHtml(slug)}</p>`
          : `<p class="hp-slot-card__empty-text">No page assigned to this slot.</p>`;
        const actions = filled
          ? `<button type="button" class="header-action-btn header-action-btn--danger smallbox-clear" data-slug="${escapeHtml(slug)}">Clear slot</button>
             <a href="${generatorEditLink(slug)}">Edit in Generator</a>
             <a href="/${escapeHtml(slug)}" target="_blank" rel="noopener">View</a>`
          : "";

        return `<article class="hp-slot-card hp-slot-card--${filled ? "filled" : "empty"}">
          <div class="hp-slot-card__head">
            <div>
              <span class="hp-slot-card__label">${slotLabel}</span>
              ${desktopNote}
            </div>
            ${chip}
          </div>
          ${body}
          ${actions ? `<div class="hp-slot-card__actions">${actions}</div>` : ""}
        </article>`;
      })
      .join("")}</div>`;

    wireSmallBoxesActions();
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  async function loadOverview() {
    ["breakingList", "badgesList"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = skeletonHtml();
    });
    const smallBoxesEl = document.getElementById("smallBoxesList");
    if (smallBoxesEl) smallBoxesEl.innerHTML = slotSkeletonHtml();

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
      "breakingMeta",
      `${meta.breakingTotal || 0} flagged · ${meta.breakingOnHomepage || 0} on ticker (max ${meta.homepageTickerLimit || 10})${
        meta.breakingOverflow ? ` · ${meta.breakingOverflow} overflow` : ""
      }`
    );
    setText(
      "badgesMeta",
      `${meta.badgePagesTotal || 0} pages · max ${overviewMeta.maxBadgesPerPage} badges each`
    );
    setText(
      "smallBoxesMeta",
      `${meta.smallBoxSlotsTotal || 0} of 4 slots filled · search by title above to assign`
    );
    window.AdminPageToolbar?.markUpdated?.();
  }

  document.getElementById("homepageMgmtRefreshBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    await withSaveLoading(btn, loadOverview, "Refreshing...");
  });
  window.adminPageRefreshHandler = loadOverview;
  loadOverview();
})();
