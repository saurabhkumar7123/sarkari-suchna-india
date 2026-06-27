"use strict";

/**
 * Normalize DB/API event_time to datetime-local style for clients (YYYY-MM-DDTHH:mm).
 * @param {unknown} value
 * @returns {string | null}
 */
function formatEventTimeForClient(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const pad = (n) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  const s = String(value).trim();
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(s);
  return m ? `${m[1]}T${m[2]}` : s;
}

module.exports = {
  formatEventTimeForClient
};
