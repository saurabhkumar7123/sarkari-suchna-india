"use strict";

const db = require("../config/db");
const pageRepository = require("../repositories/page.repository");
const smallBoxService = require("./smallBox.service");

async function ensureActivePageIdBySlug(slug, conn) {
  const pageId = await pageRepository.findActiveIdBySlug(slug, conn);
  if (!pageId) {
    const err = new Error("Page not found");
    err.code = "PAGE_NOT_FOUND";
    throw err;
  }
  return pageId;
}

/**
 * @param {string} slug
 * @param {{ breaking: boolean, breakingOrder?: number }} input
 */
async function updateBreakingPlacement(slug, { breaking, breakingOrder = 0 }) {
  const cleanSlug = String(slug || "").trim().replace(/^\/+|\.html$/gi, "");
  if (!cleanSlug) {
    const err = new Error("Invalid slug");
    err.code = "INVALID_SLUG";
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureActivePageIdBySlug(cleanSlug, conn);
    const result = await pageRepository.updateBreakingFieldsBySlug(
      cleanSlug,
      breaking,
      breakingOrder,
      conn
    );
    if (!result || !result.affectedRows) {
      const err = new Error("Page not found");
      err.code = "PAGE_NOT_FOUND";
      throw err;
    }
    await conn.commit();
    return { slug: cleanSlug, breaking: !!breaking, breakingOrder: breakingOrder ?? 0 };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * @param {string} slug
 * @param {string[]} badges
 */
async function updateBadgePlacement(slug, badges) {
  const cleanSlug = String(slug || "").trim().replace(/^\/+|\.html$/gi, "");
  if (!cleanSlug) {
    const err = new Error("Invalid slug");
    err.code = "INVALID_SLUG";
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureActivePageIdBySlug(cleanSlug, conn);
    const result = await pageRepository.updateBadgesBySlug(cleanSlug, badges, conn);
    if (!result || !result.affectedRows) {
      const err = new Error("Page not found");
      err.code = "PAGE_NOT_FOUND";
      throw err;
    }
    await conn.commit();
    return { slug: cleanSlug, badges: Array.isArray(badges) ? badges : [] };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * @param {string} slug
 * @param {unknown} smallBoxSlot
 */
async function updateSmallBoxPlacement(slug, smallBoxSlot) {
  const cleanSlug = String(slug || "").trim().replace(/^\/+|\.html$/gi, "");
  if (!cleanSlug) {
    const err = new Error("Invalid slug");
    err.code = "INVALID_SLUG";
    throw err;
  }

  const slotParsed = smallBoxService.parseSmallBoxSlot(smallBoxSlot);
  if (!slotParsed.ok) {
    const err = new Error(slotParsed.error);
    err.code = "INVALID_SLOT";
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const pageId = await ensureActivePageIdBySlug(cleanSlug, conn);
    await smallBoxService.assignSmallBoxSlot({
      pageId,
      slot: slotParsed.value,
      conn
    });
    await conn.commit();
    return { slug: cleanSlug, smallBoxSlot: slotParsed.value };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  updateBreakingPlacement,
  updateBadgePlacement,
  updateSmallBoxPlacement
};
