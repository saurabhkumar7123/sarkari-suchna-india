"use strict";

const recruitmentRepository = require("../repositories/recruitment.repository");
const recruitmentEventRepository = require("../repositories/recruitmentEvent.repository");
const recruitmentUpdateLinkRepository = require("../repositories/recruitmentUpdateLink.repository");

function assertLinkageReady() {
  return recruitmentUpdateLinkRepository.linkageColumnsExist().then((ok) => {
    if (!ok) {
      const err = new Error(
        "updates recruitment linkage columns are missing. Run db/migrations/2026-07-13-add-updates-recruitment-linkage.sql"
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

function parseOptionalPositiveId(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return parsePositiveId(value, fieldName);
}

async function resolveUpdateLinkage(input = {}) {
  const updateId = parsePositiveId(input.update_id, "update_id");
  const update = await recruitmentUpdateLinkRepository.findUpdateLinkageById(updateId);
  if (!update) {
    const err = new Error("Update not found");
    err.statusCode = 404;
    throw err;
  }
  return update;
}

async function assertRecruitmentExists(recruitmentId) {
  const recruitment = await recruitmentRepository.getRecruitmentById(recruitmentId);
  if (!recruitment) {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    throw err;
  }
  return recruitment;
}

async function assertRecruitmentEventExists(recruitmentEventId, recruitmentId) {
  const event = await recruitmentEventRepository.getRecruitmentEventById(recruitmentEventId);
  if (!event) {
    const err = new Error("Recruitment event not found");
    err.statusCode = 404;
    throw err;
  }
  if (Number(event.recruitment_id) !== Number(recruitmentId)) {
    const err = new Error("recruitment_event_id does not belong to recruitment_id");
    err.statusCode = 400;
    throw err;
  }
  return event;
}

async function linkUpdate(input = {}) {
  await assertLinkageReady();
  const update = await resolveUpdateLinkage(input);
  const recruitmentId = parsePositiveId(input.recruitment_id, "recruitment_id");
  const recruitmentEventId = parseOptionalPositiveId(
    input.recruitment_event_id,
    "recruitment_event_id"
  );

  await assertRecruitmentExists(recruitmentId);
  if (recruitmentEventId != null) {
    await assertRecruitmentEventExists(recruitmentEventId, recruitmentId);
  }

  const linked = await recruitmentUpdateLinkRepository.setUpdateLinkage(update.id, {
    recruitment_id: recruitmentId,
    recruitment_event_id: recruitmentEventId
  });
  if (!linked) {
    const err = new Error("Update not found");
    err.statusCode = 404;
    throw err;
  }
  return linked;
}

async function unlinkUpdate(input = {}) {
  await assertLinkageReady();
  const update = await resolveUpdateLinkage(input);

  const cleared = await recruitmentUpdateLinkRepository.clearUpdateLinkage(update.id);
  if (!cleared) {
    const err = new Error("Update not found");
    err.statusCode = 404;
    throw err;
  }
  return cleared;
}

async function getUpdateLinkage(input = {}) {
  await assertLinkageReady();
  return resolveUpdateLinkage(input);
}

async function listLinkedUpdates(query = {}) {
  await assertLinkageReady();

  const hasRecruitmentId =
    query.recruitment_id !== undefined && query.recruitment_id !== null && query.recruitment_id !== "";
  const hasEventId =
    query.recruitment_event_id !== undefined &&
    query.recruitment_event_id !== null &&
    query.recruitment_event_id !== "";

  if (hasRecruitmentId === hasEventId) {
    const err = new Error("Provide exactly one of recruitment_id or recruitment_event_id");
    err.statusCode = 400;
    throw err;
  }

  if (hasRecruitmentId) {
    const recruitmentId = parsePositiveId(query.recruitment_id, "recruitment_id");
    await assertRecruitmentExists(recruitmentId);
    return recruitmentUpdateLinkRepository.listUpdateLinkagesByRecruitmentId({
      recruitment_id: recruitmentId,
      page: query.page,
      limit: query.limit
    });
  }

  const recruitmentEventId = parsePositiveId(query.recruitment_event_id, "recruitment_event_id");
  const event = await recruitmentEventRepository.getRecruitmentEventById(recruitmentEventId);
  if (!event) {
    const err = new Error("Recruitment event not found");
    err.statusCode = 404;
    throw err;
  }
  return recruitmentUpdateLinkRepository.listUpdateLinkagesByRecruitmentEventId({
    recruitment_event_id: recruitmentEventId,
    page: query.page,
    limit: query.limit
  });
}

module.exports = {
  linkUpdate,
  unlinkUpdate,
  getUpdateLinkage,
  listLinkedUpdates
};
