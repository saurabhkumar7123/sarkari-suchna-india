"use strict";

const recruitmentRepository = require("../repositories/recruitment.repository");
const recruitmentEventRepository = require("../repositories/recruitmentEvent.repository");
const recruitmentPageLinkRepository = require("../repositories/recruitmentPageLink.repository");

function assertLinkageReady() {
  return recruitmentPageLinkRepository.linkageColumnsExist().then((ok) => {
    if (!ok) {
      const err = new Error(
        "pages recruitment linkage columns are missing. Run db/migrations/2026-07-13-add-pages-recruitment-linkage.sql"
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

function trimSlug(value) {
  return String(value ?? "").trim();
}

function parsePageRef(input = {}) {
  if (input.page_id !== undefined && input.page_id !== null && input.page_id !== "") {
    return { kind: "id", value: parsePositiveId(input.page_id, "page_id") };
  }
  const slug = trimSlug(input.slug);
  if (slug) {
    return { kind: "slug", value: slug };
  }
  const err = new Error("page_id or slug is required");
  err.statusCode = 400;
  throw err;
}

async function resolvePageLinkage(input = {}) {
  const ref = parsePageRef(input);
  const page =
    ref.kind === "id"
      ? await recruitmentPageLinkRepository.findPageLinkageById(ref.value)
      : await recruitmentPageLinkRepository.findPageLinkageBySlug(ref.value);
  if (!page) {
    const err = new Error("Page not found");
    err.statusCode = 404;
    throw err;
  }
  return page;
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

function parseOptionalPositiveId(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return parsePositiveId(value, fieldName);
}

async function linkPage(input = {}) {
  await assertLinkageReady();
  const page = await resolvePageLinkage(input);
  const recruitmentId = parsePositiveId(input.recruitment_id, "recruitment_id");
  const recruitmentEventId = parseOptionalPositiveId(
    input.recruitment_event_id,
    "recruitment_event_id"
  );

  await assertRecruitmentExists(recruitmentId);
  if (recruitmentEventId != null) {
    await assertRecruitmentEventExists(recruitmentEventId, recruitmentId);
  }

  const updated = await recruitmentPageLinkRepository.setPageLinkage(page.id, {
    recruitment_id: recruitmentId,
    recruitment_event_id: recruitmentEventId
  });
  if (!updated) {
    const err = new Error("Page not found");
    err.statusCode = 404;
    throw err;
  }
  return updated;
}

async function unlinkPage(input = {}) {
  await assertLinkageReady();
  const page = await resolvePageLinkage(input);

  const updated = await recruitmentPageLinkRepository.clearPageLinkage(page.id);
  if (!updated) {
    const err = new Error("Page not found");
    err.statusCode = 404;
    throw err;
  }
  return updated;
}

async function getPageLinkage(input = {}) {
  await assertLinkageReady();
  return resolvePageLinkage(input);
}

async function listLinkedPages(query = {}) {
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
    return recruitmentPageLinkRepository.listPageLinkagesByRecruitmentId({
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
  return recruitmentPageLinkRepository.listPageLinkagesByRecruitmentEventId({
    recruitment_event_id: recruitmentEventId,
    page: query.page,
    limit: query.limit
  });
}

module.exports = {
  linkPage,
  unlinkPage,
  getPageLinkage,
  listLinkedPages
};
