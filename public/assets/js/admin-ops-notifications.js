/**
 * Package 4E — Local operational notifications (UI only).
 * No email, push, workers, or background polling.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "adminOpsNotifications.v1";
  const MAX_ITEMS = 40;

  function readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function writeAll(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    } catch {
      /* ignore quota */
    }
  }

  function push(entry) {
    const items = readAll();
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: String((entry && entry.type) || "info"),
      text: String((entry && entry.text) || "").slice(0, 240),
      href: entry && entry.href ? String(entry.href) : "",
      createdAt: new Date().toISOString(),
      read: false
    };
    if (!item.text) return item;
    items.unshift(item);
    writeAll(items);
    document.dispatchEvent(new CustomEvent("adminOpsNotification", { detail: item }));
    return item;
  }

  function list({ includeRead = true, limit = 20 } = {}) {
    let items = readAll();
    if (!includeRead) items = items.filter((i) => !i.read);
    return items.slice(0, Math.max(1, limit));
  }

  function unreadCount() {
    return readAll().filter((i) => !i.read).length;
  }

  function markAllRead() {
    const items = readAll().map((i) => ({ ...i, read: true }));
    writeAll(items);
  }

  function clear() {
    writeAll([]);
  }

  window.AdminOpsNotifications = {
    push,
    list,
    unreadCount,
    markAllRead,
    clear,
    TYPES: {
      REVIEW_COMPLETED: "review_completed",
      DRAFT_ATTACHED: "draft_attached",
      VALIDATION_WARNING: "validation_warning",
      BROKEN_PAGE_LINK: "broken_page_link",
      BULK_ACTION: "bulk_action",
      INFO: "info"
    }
  };
})();
