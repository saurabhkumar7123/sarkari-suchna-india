"use strict";

function normalizeString(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function buildEqualityFilter(field, value, params) {
  if (value === undefined || value === null || value === "") return null;
  params.push(value);
  return `${field} = ?`;
}

function buildLikeFilter(field, value, params) {
  const term = normalizeString(value, 200);
  if (!term) return null;
  params.push(`%${term}%`);
  return `${field} LIKE ?`;
}

function buildInFilter(field, values, params) {
  const list = (Array.isArray(values) ? values : [])
    .map((v) => normalizeString(v, 200))
    .filter(Boolean);
  if (!list.length) return null;
  params.push(...list);
  return `${field} IN (${list.map(() => "?").join(", ")})`;
}

function buildDateRangeFilter(field, from, to, params) {
  const clauses = [];
  if (from) {
    clauses.push(`${field} >= ?`);
    params.push(from);
  }
  if (to) {
    clauses.push(`${field} <= ?`);
    params.push(to);
  }
  return clauses.length ? clauses.join(" AND ") : null;
}

function combineWhereClauses(clauses = []) {
  const active = clauses.filter(Boolean);
  if (!active.length) return { where: "", params: [] };
  const params = [];
  const parts = active.map((clause) => {
    if (typeof clause === "string") return clause;
    if (clause && clause.sql) {
      params.push(...(clause.params || []));
      return clause.sql;
    }
    return null;
  }).filter(Boolean);
  return { where: `WHERE ${parts.join(" AND ")}`, params };
}

function applyMemoryFilters(rows, filters = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        if (!value.includes(row[key])) return false;
      } else if (String(row[key] ?? "").toLowerCase() !== String(value).toLowerCase()) {
        return false;
      }
    }
    return true;
  });
}

module.exports = {
  normalizeString,
  buildEqualityFilter,
  buildLikeFilter,
  buildInFilter,
  buildDateRangeFilter,
  combineWhereClauses,
  applyMemoryFilters
};
