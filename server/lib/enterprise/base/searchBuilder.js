"use strict";

const { normalizeString } = require("./filterBuilder");

function buildSearchClause(columns, term, params) {
  const query = normalizeString(term, 200);
  if (!query || !Array.isArray(columns) || !columns.length) {
    return null;
  }
  const like = `%${query}%`;
  const parts = columns.map((col) => {
    params.push(like);
    return `${col} LIKE ?`;
  });
  return `(${parts.join(" OR ")})`;
}

function matchesSearch(row, term, fields = []) {
  const query = normalizeString(term, 200).toLowerCase();
  if (!query) return true;
  return fields.some((field) =>
    String(row[field] ?? "")
      .toLowerCase()
      .includes(query)
  );
}

function sortRows(rows, sortBy = "updated_at", sortOrder = "desc") {
  const field = String(sortBy || "updated_at");
  const direction = String(sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * direction;
    if (av > bv) return 1 * direction;
    return 0;
  });
}

module.exports = {
  buildSearchClause,
  matchesSearch,
  sortRows
};
