"use strict";

const db = require("../../../config/db");

async function withTransaction(handler) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (err) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback failure
    }
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  withTransaction
};
