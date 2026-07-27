"use strict";

const db = require("../../../config/db");
const { tableExists } = require("./schemaGuard");
const { parsePage, parseLimit, buildOffset, buildPaginationResult } = require("./pagination");
const { buildSearchClause } = require("./searchBuilder");
const { combineWhereClauses } = require("./filterBuilder");
const { parseJsonColumn, stringifyJson } = require("./jsonColumn");

class BaseRepository {
  constructor({ tableName, storeName, defaultOrder = "updated_at DESC, id DESC" }) {
    this.tableName = tableName;
    this.storeName = storeName || tableName;
    this.defaultOrder = defaultOrder;
  }

  async isSqlReady() {
    return tableExists(this.tableName);
  }

  async query(sql, params = [], connection = null) {
    const executor = connection || db;
    const [rows] = await executor.query(sql, params);
    return rows;
  }

  parseJsonFields(row, fields = []) {
    if (!row) return null;
    const copy = { ...row };
    for (const field of fields) {
      if (field in copy) copy[field] = parseJsonColumn(copy[field]);
    }
    return copy;
  }

  buildListQuery({ filters = [], searchColumns = [], searchTerm = "", extraWhere = "" } = {}) {
    const params = [];
    const filterClauses = filters
      .map((filter) => {
        if (!filter || !filter.sql) return null;
        params.push(...(filter.params || []));
        return filter.sql;
      })
      .filter(Boolean);
    const searchClause = buildSearchClause(searchColumns, searchTerm, params);
    if (searchClause) filterClauses.push(searchClause);
    if (extraWhere) filterClauses.push(extraWhere);
    const { where, params: whereParams } = combineWhereClauses(filterClauses);
    return { where, params: [...params, ...whereParams] };
  }

  async paginatedSelect({
    select = "*",
    where = "",
    params = [],
    page = 1,
    limit = 20,
    orderBy = null
  }) {
    const safePage = parsePage(page);
    const safeLimit = parseLimit(limit);
    const offset = buildOffset(safePage, safeLimit);
    const order = orderBy || this.defaultOrder;
    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM ${this.tableName} ${where}`,
      params
    );
    const rows = await this.query(
      `SELECT ${select} FROM ${this.tableName} ${where}
       ORDER BY ${order}
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );
    return buildPaginationResult({
      page: safePage,
      limit: safeLimit,
      total: countRow && countRow.total != null ? Number(countRow.total) : 0,
      data: rows
    });
  }

  serializeRow(row, jsonFields = []) {
    const copy = { ...row };
    for (const field of jsonFields) {
      if (field in copy) copy[field] = stringifyJson(copy[field]);
    }
    return copy;
  }
}

module.exports = {
  BaseRepository
};
