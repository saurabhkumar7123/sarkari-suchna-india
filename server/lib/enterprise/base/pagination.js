"use strict";

function parsePositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = parseInt(String(value ?? fallback), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parsePage(value, fallback = 1) {
  return parsePositiveInt(value, fallback, { min: 1, max: 100000 });
}

function parseLimit(value, fallback = 20, max = 100) {
  return parsePositiveInt(value, fallback, { min: 1, max });
}

function buildOffset(page, limit) {
  return (page - 1) * limit;
}

function buildPaginationResult({ page, limit, total, data }) {
  return {
    data: Array.isArray(data) ? data : [],
    pagination: {
      page,
      limit,
      total: Number(total) || 0,
      totalPages: limit > 0 ? Math.ceil((Number(total) || 0) / limit) : 0
    }
  };
}

function paginateArray(rows, page, limit) {
  const safePage = parsePage(page);
  const safeLimit = parseLimit(limit);
  const total = Array.isArray(rows) ? rows.length : 0;
  const offset = buildOffset(safePage, safeLimit);
  return buildPaginationResult({
    page: safePage,
    limit: safeLimit,
    total,
    data: (Array.isArray(rows) ? rows : []).slice(offset, offset + safeLimit)
  });
}

module.exports = {
  parsePage,
  parseLimit,
  buildOffset,
  buildPaginationResult,
  paginateArray
};
