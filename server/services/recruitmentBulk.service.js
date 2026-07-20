"use strict";

/**
 * Package 4E — Bulk recruitment operations.
 *
 * Manual, confirmation-gated batch actions only.
 * No automation, workers, schedulers, or publishing.
 */

const recruitmentRepository = require("../repositories/recruitment.repository");
const recruitmentEventRepository = require("../repositories/recruitmentEvent.repository");
const recruitmentPageLinkRepository = require("../repositories/recruitmentPageLink.repository");
const recruitmentOpsMetadataRepository = require("../repositories/recruitmentOpsMetadata.repository");
const editorialReviewRepository = require("../repositories/editorialReview.repository");
const sharedPreviewRepository = require("../repositories/sharedPreview.repository");
const { LIFECYCLE_STATES, normalizeLifecycleState } = require("./recruitment.service");

const BULK_ACTIONS = Object.freeze([
  "archive",
  "restore",
  "status_update",
  "category_update",
  "assignment",
  "delete"
]);

const MAX_BULK_IDS = 50;

function assertTable() {
  return recruitmentRepository.tableExists().then((ok) => {
    if (!ok) {
      const err = new Error(
        "recruitments table is missing. Run db/migrations/2026-07-13-recruitments.sql"
      );
      err.statusCode = 503;
      throw err;
    }
  });
}

function normalizeIds(ids) {
  const unique = [
    ...new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => parseInt(String(id), 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  ];
  if (!unique.length) {
    const err = new Error("ids must include at least one valid recruitment id");
    err.statusCode = 400;
    throw err;
  }
  if (unique.length > MAX_BULK_IDS) {
    const err = new Error(`ids cannot exceed ${MAX_BULK_IDS} items`);
    err.statusCode = 400;
    throw err;
  }
  return unique;
}

function normalizeAction(action) {
  const value = String(action || "")
    .trim()
    .toLowerCase();
  if (!BULK_ACTIONS.includes(value)) {
    const err = new Error("Invalid bulk action");
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function requireConfirmation(confirmed) {
  if (confirmed !== true) {
    const err = new Error("Explicit confirmation is required (confirm: true)");
    err.statusCode = 400;
    throw err;
  }
}

function trimCategory(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, 128) : null;
}

function trimAssignee(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    const err = new Error("assignee is required for assignment");
    err.statusCode = 400;
    throw err;
  }
  return trimmed.slice(0, 128);
}

async function cleanupRelated(recruitmentId) {
  await recruitmentEventRepository.deleteEventsByRecruitmentId(recruitmentId).catch(() => 0);
  await recruitmentPageLinkRepository.clearLinkagesByRecruitmentId(recruitmentId).catch(() => 0);
  recruitmentOpsMetadataRepository.removeAssignment(recruitmentId);
  editorialReviewRepository.deleteReview(recruitmentId);
  sharedPreviewRepository.deletePreviewRecord(recruitmentId);
}

async function applyOne(action, row, payload, operator) {
  const id = row.id;
  switch (action) {
    case "archive": {
      if (row.lifecycle_state === "closed") {
        return { id, status: "skipped", reason: "already_archived" };
      }
      const updated = await recruitmentRepository.patchRecruitment(id, {
        lifecycle_state: "closed"
      });
      return { id, status: "ok", data: updated };
    }
    case "restore": {
      if (row.lifecycle_state !== "closed") {
        return { id, status: "skipped", reason: "not_archived" };
      }
      const restoredState = normalizeLifecycleState(payload.lifecycle_state || "open", {
        required: true
      });
      if (restoredState === "closed") {
        const err = new Error("restore lifecycle_state cannot be closed");
        err.statusCode = 400;
        throw err;
      }
      const updated = await recruitmentRepository.patchRecruitment(id, {
        lifecycle_state: restoredState
      });
      return { id, status: "ok", data: updated };
    }
    case "status_update": {
      const lifecycle_state = normalizeLifecycleState(payload.lifecycle_state, {
        required: true
      });
      const updated = await recruitmentRepository.patchRecruitment(id, { lifecycle_state });
      return { id, status: "ok", data: updated };
    }
    case "category_update": {
      const department = trimCategory(payload.category ?? payload.department);
      const updated = await recruitmentRepository.patchRecruitment(id, { department });
      return { id, status: "ok", data: updated };
    }
    case "assignment": {
      const assignee = trimAssignee(payload.assignee);
      const assignment = recruitmentOpsMetadataRepository.setAssignment(id, assignee, operator);
      return { id, status: "ok", data: { ...row, assignment } };
    }
    case "delete": {
      await cleanupRelated(id);
      const deleted = await recruitmentRepository.deleteRecruitmentById(id);
      if (!deleted) {
        return { id, status: "failed", reason: "not_found" };
      }
      return { id, status: "ok", data: deleted };
    }
    default: {
      const err = new Error("Unsupported bulk action");
      err.statusCode = 400;
      throw err;
    }
  }
}

/**
 * @param {{
 *   action: string,
 *   ids: number[],
 *   confirm: boolean,
 *   lifecycle_state?: string,
 *   category?: string,
 *   department?: string,
 *   assignee?: string
 * }} input
 * @param {string|null} operator
 */
async function executeBulk(input = {}, operator = null) {
  requireConfirmation(input.confirm);
  const action = normalizeAction(input.action);
  const ids = normalizeIds(input.ids);
  await assertTable();

  if (action === "status_update" && !input.lifecycle_state) {
    const err = new Error("lifecycle_state is required for status_update");
    err.statusCode = 400;
    throw err;
  }
  if (action === "category_update" && input.category == null && input.department == null) {
    const err = new Error("category (or department) is required for category_update");
    err.statusCode = 400;
    throw err;
  }
  if (action === "assignment" && !String(input.assignee || "").trim()) {
    const err = new Error("assignee is required for assignment");
    err.statusCode = 400;
    throw err;
  }

  const rows = await recruitmentRepository.getRecruitmentsByIds(ids);
  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  const results = [];

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      results.push({ id, status: "failed", reason: "not_found" });
      continue;
    }
    try {
      results.push(await applyOne(action, row, input, operator));
    } catch (err) {
      results.push({
        id,
        status: "failed",
        reason: err && err.message ? err.message : "failed"
      });
    }
  }

  const summary = {
    action,
    requested: ids.length,
    ok: results.filter((r) => r.status === "ok").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length
  };

  return { summary, results };
}

module.exports = {
  BULK_ACTIONS,
  MAX_BULK_IDS,
  LIFECYCLE_STATES,
  executeBulk
};
