"use strict";

const recruitmentRepository = require("../repositories/recruitment.repository");
const recruitmentEventService = require("./recruitmentEvent.service");
const recruitmentPageLinkService = require("./recruitmentPageLink.service");
const generatorDraftService = require("./generatorDraft.service");
const {
  normalizeFilesystemSlug,
  isValidFilesystemSlug
} = require("../lib/safeFilesystemPath");

const LIFECYCLE_STATES = Object.freeze([
  "announced",
  "open",
  "exam_scheduled",
  "post_exam",
  "results",
  "closed"
]);

const DEFAULT_LIFECYCLE_STATE = "announced";

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

function trimString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function trimRequiredString(value, fieldName) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    const err = new Error(`${fieldName} is required`);
    err.statusCode = 400;
    throw err;
  }
  return trimmed;
}

function normalizeSlug(raw) {
  const slug = normalizeFilesystemSlug(String(raw ?? "").replace(/^\//, ""));
  if (!slug || !isValidFilesystemSlug(slug)) {
    const err = new Error("slug is required");
    err.statusCode = 400;
    throw err;
  }
  return slug.slice(0, 255);
}

function normalizeCycleYear(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const year = parseInt(String(value), 10);
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    const err = new Error("cycle_year must be a valid year");
    err.statusCode = 400;
    throw err;
  }
  return year;
}

function normalizeSearch(value) {
  if (value === undefined || value === null) return undefined;
  const search = String(value).trim();
  return search ? search.slice(0, 200) : undefined;
}

function normalizeLifecycleState(value, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      const err = new Error("lifecycle_state is required");
      err.statusCode = 400;
      throw err;
    }
    return DEFAULT_LIFECYCLE_STATE;
  }
  const state = String(value).trim().toLowerCase();
  if (!LIFECYCLE_STATES.includes(state)) {
    const err = new Error("Invalid lifecycle_state");
    err.statusCode = 400;
    throw err;
  }
  return state;
}

function normalizeRecruitmentInput(input = {}, { existing = null } = {}) {
  const title = trimRequiredString(
    input.title !== undefined ? input.title : existing?.title,
    "title"
  );
  const slug = normalizeSlug(input.slug !== undefined ? input.slug : existing?.slug);
  const department =
    input.department !== undefined
      ? trimString(input.department)
      : existing?.department ?? null;
  const post_name =
    input.post_name !== undefined ? trimString(input.post_name) : existing?.post_name ?? null;
  const advertisement_no =
    input.advertisement_no !== undefined
      ? trimString(input.advertisement_no)
      : existing?.advertisement_no ?? null;
  const cycle_year =
    input.cycle_year !== undefined
      ? normalizeCycleYear(input.cycle_year)
      : existing?.cycle_year ?? null;
  const lifecycle_state = normalizeLifecycleState(
    input.lifecycle_state !== undefined ? input.lifecycle_state : existing?.lifecycle_state,
    { required: false }
  );

  return {
    title: title.slice(0, 500),
    slug,
    department: department ? department.slice(0, 128) : null,
    post_name: post_name ? post_name.slice(0, 512) : null,
    advertisement_no: advertisement_no ? advertisement_no.slice(0, 128) : null,
    cycle_year,
    lifecycle_state
  };
}

async function assertSlugAvailable(slug, excludeId = null) {
  const taken = await recruitmentRepository.existsBySlug(slug, excludeId);
  if (taken) {
    const err = new Error("slug must be unique");
    err.statusCode = 409;
    throw err;
  }
}

async function createRecruitment(input = {}) {
  await assertTable();
  const row = normalizeRecruitmentInput(input);
  await assertSlugAvailable(row.slug);
  return recruitmentRepository.createRecruitment(row);
}

async function updateRecruitment(id, input = {}) {
  await assertTable();
  const recruitmentId = parseInt(String(id), 10);
  if (!Number.isInteger(recruitmentId) || recruitmentId <= 0) {
    const err = new Error("Invalid recruitment id");
    err.statusCode = 400;
    throw err;
  }

  const existing = await recruitmentRepository.getRecruitmentById(recruitmentId);
  if (!existing) {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    throw err;
  }

  const row = normalizeRecruitmentInput(input, { existing });
  await assertSlugAvailable(row.slug, recruitmentId);

  const updated = await recruitmentRepository.updateRecruitment(recruitmentId, row);
  if (!updated) {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    throw err;
  }
  return updated;
}

async function getRecruitment(id) {
  await assertTable();
  const recruitmentId = parseInt(String(id), 10);
  if (!Number.isInteger(recruitmentId) || recruitmentId <= 0) {
    const err = new Error("Invalid recruitment id");
    err.statusCode = 400;
    throw err;
  }

  const row = await recruitmentRepository.getRecruitmentById(recruitmentId);
  if (!row) {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    throw err;
  }
  return row;
}

async function getRecruitmentBySlug(slug) {
  await assertTable();
  const normalizedSlug = normalizeSlug(slug);
  const row = await recruitmentRepository.getRecruitmentBySlug(normalizedSlug);
  if (!row) {
    const err = new Error("Recruitment not found");
    err.statusCode = 404;
    throw err;
  }
  return row;
}

async function listRecruitments(query = {}) {
  await assertTable();
  const lifecycle_state = query.lifecycle_state
    ? normalizeLifecycleState(query.lifecycle_state, { required: true })
    : undefined;
  const cycle_year =
    query.cycle_year !== undefined && query.cycle_year !== ""
      ? normalizeCycleYear(query.cycle_year)
      : undefined;
  return recruitmentRepository.listRecruitments({
    page: query.page,
    limit: query.limit,
    lifecycle_state,
    cycle_year,
    search: normalizeSearch(query.search)
  });
}

async function listLinkedPagesForDetail(recruitmentId, query = {}) {
  try {
    const result = await recruitmentPageLinkService.listLinkedPages({
      recruitment_id: recruitmentId,
      page: query.pages_page || query.page,
      limit: query.pages_limit || query.limit
    });
    return Array.isArray(result.data) ? result.data : [];
  } catch (err) {
    if (err && err.statusCode === 503) {
      return [];
    }
    throw err;
  }
}

async function getRecruitmentDetail(id, query = {}) {
  const recruitment = await getRecruitment(id);
  const recruitmentId = recruitment.id;

  const [eventsResult, pages, drafts] = await Promise.all([
    recruitmentEventService.listRecruitmentEvents({
      recruitment_id: recruitmentId,
      page: query.events_page || query.page,
      limit: query.events_limit || query.limit,
      status: query.events_status || query.status
    }),
    listLinkedPagesForDetail(recruitmentId, query),
    generatorDraftService.listDraftsByRecruitmentId(recruitmentId, {
      limit: query.drafts_limit || query.limit
    })
  ]);

  return {
    recruitment,
    events: Array.isArray(eventsResult.data) ? eventsResult.data : [],
    pages,
    drafts: Array.isArray(drafts) ? drafts : []
  };
}

module.exports = {
  LIFECYCLE_STATES,
  normalizeLifecycleState,
  createRecruitment,
  updateRecruitment,
  getRecruitment,
  getRecruitmentBySlug,
  listRecruitments,
  getRecruitmentDetail
};
