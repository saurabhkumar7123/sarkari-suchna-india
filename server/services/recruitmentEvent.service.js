"use strict";

const recruitmentRepository = require("../repositories/recruitment.repository");
const recruitmentEventRepository = require("../repositories/recruitmentEvent.repository");

const EVENT_TYPES = Object.freeze([
  "notification",
  "short_notification",
  "correction",
  "exam_date",
  "city_intimation",
  "admit_card",
  "answer_key",
  "objection",
  "result",
  "final_result",
  "dv",
  "medical",
  "joining"
]);

const EVENT_STATUSES = Object.freeze(["pending", "active", "superseded", "cancelled"]);

const DEFAULT_EVENT_STATUS = "pending";
const MAX_SEQUENCE_ORDER = 65535;

function assertTable() {
  return recruitmentEventRepository.tableExists().then((ok) => {
    if (!ok) {
      const err = new Error(
        "recruitment_events table is missing. Run db/migrations/2026-07-13-recruitment-events.sql"
      );
      err.statusCode = 503;
      throw err;
    }
  });
}

function parsePositiveId(value, fieldName) {
  const id = parseInt(String(value), 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error(`Invalid ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  return id;
}

function normalizeEventType(value, { existing = null, required = true } = {}) {
  const raw = value !== undefined ? value : existing?.event_type;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    if (required) {
      const err = new Error("event_type is required");
      err.statusCode = 400;
      throw err;
    }
    return existing?.event_type;
  }
  const eventType = String(raw).trim().toLowerCase();
  if (!EVENT_TYPES.includes(eventType)) {
    const err = new Error("Invalid event_type");
    err.statusCode = 400;
    throw err;
  }
  return eventType;
}

function normalizeEventStatus(value, { existing = null, required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      const err = new Error("status is required");
      err.statusCode = 400;
      throw err;
    }
    return existing?.status ?? DEFAULT_EVENT_STATUS;
  }
  const status = String(value).trim().toLowerCase();
  if (!EVENT_STATUSES.includes(status)) {
    const err = new Error("Invalid status");
    err.statusCode = 400;
    throw err;
  }
  return status;
}

function normalizeSequenceOrder(value, { existing = null } = {}) {
  if (value === undefined || value === null || value === "") {
    return existing?.sequence_order ?? 0;
  }
  const order = parseInt(String(value), 10);
  if (!Number.isInteger(order) || order < 0 || order > MAX_SEQUENCE_ORDER) {
    const err = new Error("sequence_order must be an integer between 0 and 65535");
    err.statusCode = 400;
    throw err;
  }
  return order;
}

function normalizeRecruitmentEventInput(input = {}, { existing = null } = {}) {
  const recruitment_id =
    input.recruitment_id !== undefined
      ? parsePositiveId(input.recruitment_id, "recruitment_id")
      : parsePositiveId(existing?.recruitment_id, "recruitment_id");

  return {
    recruitment_id,
    event_type: normalizeEventType(input.event_type, { existing }),
    sequence_order: normalizeSequenceOrder(input.sequence_order, { existing }),
    status: normalizeEventStatus(input.status, { existing })
  };
}

async function assertRecruitmentExists(recruitmentId) {
  const parent = await recruitmentRepository.getRecruitmentById(recruitmentId);
  if (!parent) {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    throw err;
  }
  return parent;
}

async function createRecruitmentEvent(input = {}) {
  await assertTable();
  const row = normalizeRecruitmentEventInput(input);
  await assertRecruitmentExists(row.recruitment_id);
  return recruitmentEventRepository.createRecruitmentEvent(row);
}

async function updateRecruitmentEvent(id, input = {}) {
  await assertTable();
  const eventId = parsePositiveId(id, "recruitment event id");

  const existing = await recruitmentEventRepository.getRecruitmentEventById(eventId);
  if (!existing) {
    const err = new Error("Recruitment event not found");
    err.statusCode = 404;
    throw err;
  }

  const row = normalizeRecruitmentEventInput(input, { existing });
  await assertRecruitmentExists(row.recruitment_id);

  const updated = await recruitmentEventRepository.updateRecruitmentEvent(eventId, row);
  if (!updated) {
    const err = new Error("Recruitment event not found");
    err.statusCode = 404;
    throw err;
  }
  return updated;
}

async function getRecruitmentEvent(id) {
  await assertTable();
  const eventId = parsePositiveId(id, "recruitment event id");

  const row = await recruitmentEventRepository.getRecruitmentEventById(eventId);
  if (!row) {
    const err = new Error("Recruitment event not found");
    err.statusCode = 404;
    throw err;
  }
  return row;
}

async function deleteRecruitmentEvent(id) {
  await assertTable();
  const eventId = parsePositiveId(id, "recruitment event id");
  const deleted = await recruitmentEventRepository.deleteRecruitmentEvent(eventId);
  if (!deleted) {
    const err = new Error("Recruitment event not found");
    err.statusCode = 404;
    throw err;
  }
  return deleted;
}

async function listRecruitmentEvents(query = {}) {
  await assertTable();
  const recruitmentId = parsePositiveId(query.recruitment_id, "recruitment_id");
  await assertRecruitmentExists(recruitmentId);

  const status = query.status ? normalizeEventStatus(query.status, { required: true }) : undefined;

  return recruitmentEventRepository.listRecruitmentEventsByRecruitmentId({
    recruitment_id: recruitmentId,
    status,
    page: query.page,
    limit: query.limit
  });
}

module.exports = {
  EVENT_TYPES,
  EVENT_STATUSES,
  createRecruitmentEvent,
  updateRecruitmentEvent,
  deleteRecruitmentEvent,
  getRecruitmentEvent,
  listRecruitmentEvents
};
