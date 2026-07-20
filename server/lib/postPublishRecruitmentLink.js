"use strict";

function parseOptionalPositiveId(value) {
  if (value === undefined || value === null || value === "") return null;
  const id = parseInt(String(value), 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

/**
 * Resolve recruitment linkage context for post-publish hook.
 * Prefers explicit publish body fields, then generator draft storage (Phase 16).
 */
async function resolvePublishRecruitmentContext(body = {}, getDraftById) {
  const bodyRecruitmentId = parseOptionalPositiveId(body.recruitment_id);
  if (bodyRecruitmentId != null) {
    return {
      recruitment_id: bodyRecruitmentId,
      recruitment_event_id: parseOptionalPositiveId(body.recruitment_event_id)
    };
  }

  const draftId = parseOptionalPositiveId(body.generatorDraftId);
  if (!draftId || typeof getDraftById !== "function") {
    return null;
  }

  try {
    const draft = await getDraftById(draftId);
    const recruitment_id = parseOptionalPositiveId(draft && draft.recruitment_id);
    if (recruitment_id == null) return null;
    return {
      recruitment_id,
      recruitment_event_id: parseOptionalPositiveId(draft && draft.recruitment_event_id)
    };
  } catch {
    return null;
  }
}

/**
 * Non-blocking post-publish page linkage. Never throws to caller.
 */
async function runPostPublishRecruitmentLink({
  savedPageId,
  body = {},
  getDraftById,
  linkPage,
  isEnabled = false
}) {
  if (!isEnabled) {
    return { skipped: true, reason: "flag_off" };
  }
  if (!savedPageId) {
    return { skipped: true, reason: "no_page" };
  }
  if (typeof linkPage !== "function") {
    return { skipped: true, reason: "no_linker" };
  }

  const context = await resolvePublishRecruitmentContext(body, getDraftById);
  if (!context || context.recruitment_id == null) {
    return { skipped: true, reason: "no_context" };
  }

  try {
    await linkPage({
      page_id: savedPageId,
      recruitment_id: context.recruitment_id,
      recruitment_event_id: context.recruitment_event_id
    });
    return { linked: true, recruitment_id: context.recruitment_id };
  } catch (err) {
    return {
      linked: false,
      error: err
    };
  }
}

module.exports = {
  parseOptionalPositiveId,
  resolvePublishRecruitmentContext,
  runPostPublishRecruitmentLink
};
