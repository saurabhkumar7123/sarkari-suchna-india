"use strict";

/**
 * Post-page-write lifecycle finalize boundary.
 *
 * Called only after the Generator page create/update DB+HTML write succeeded.
 * Marks draft published, links page↔recruitment, activates event, projects stage.
 *
 * Never publishes pages by itself. Never auto-publishes from automation.
 */

const logger = require("../../utils/logger");
const generatorDraftService = require("../../services/generatorDraft.service");
const recruitmentPageLinkService = require("../../services/recruitmentPageLink.service");
const recruitmentEventService = require("../../services/recruitmentEvent.service");
const recruitmentRepository = require("../../repositories/recruitment.repository");
const {
  mapEventStageToRecruitmentLifecycleState
} = require("./productionRuntime/mapEventStageToLifecycleState");
const { isDownstreamEvent, isAnnouncementEvent, normalizeEventType } = require("./lifecycleSafety");

function parsePositiveId(value) {
  if (value === undefined || value === null || value === "") return null;
  const id = parseInt(String(value), 10);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

async function projectRecruitmentStageFromEvent({ recruitmentId, eventType }) {
  const rid = parsePositiveId(recruitmentId);
  const type = normalizeEventType(eventType);
  if (!rid || !type || type === "unknown") {
    return { skipped: true, reason: "missing_ids_or_type" };
  }
  let lifecycleState;
  try {
    lifecycleState = mapEventStageToRecruitmentLifecycleState(type);
  } catch {
    return { skipped: true, reason: "unmapped_stage" };
  }
  try {
    const updated = await recruitmentRepository.patchRecruitment(rid, {
      lifecycle_state: lifecycleState
    });
    return { skipped: false, lifecycle_state: lifecycleState, recruitment: updated };
  } catch (err) {
    logger.warn("atomic-publish: stage projection failed", {
      recruitmentId: rid,
      message: err && err.message ? err.message : String(err)
    });
    return { skipped: true, reason: err && err.message ? err.message : "stage_failed" };
  }
}

/**
 * Finalize lifecycle side-effects after a successful page write.
 * Failures are returned (not thrown) so the page remains published; callers
 * may surface warnings. Draft mark-published failure is critical for atomicity
 * of draft state — caller should treat result.ok === false as incomplete finalize.
 */
async function finalizeLifecyclePublish({
  savedPageId,
  publishedSlug,
  generatorDraftId = null,
  recruitmentId = null,
  recruitmentEventId = null,
  eventType = null,
  author = "generator"
} = {}) {
  const result = {
    ok: true,
    draft: null,
    linkage: null,
    event: null,
    stage: null,
    errors: []
  };

  const pageId = parsePositiveId(savedPageId);
  const draftId = parsePositiveId(generatorDraftId);
  const rid = parsePositiveId(recruitmentId);
  let eid = parsePositiveId(recruitmentEventId);
  const slug = String(publishedSlug || "")
    .trim()
    .replace(/^\/+|\.html$/gi, "");

  if (draftId) {
    try {
      const existing = await generatorDraftService.getDraftById(draftId);
      if (existing && String(existing.status) === "published") {
        result.draft = { skipped: true, reason: "already_published", draft: existing };
      } else {
        const marked = await generatorDraftService.markDraftPublished(draftId, {
          publishedSlug: slug || existing?.slug_hint || null,
          publishedPageId: pageId
        });
        result.draft = { skipped: false, draft: marked };
        if (!rid && marked && marked.recruitment_id) {
          // prefer draft linkage when body omitted recruitment
        }
      }
    } catch (err) {
      result.ok = false;
      result.errors.push({ step: "draft_mark_published", message: err.message });
      logger.error("atomic-publish: draft mark-published failed", {
        draftId,
        message: err && err.message ? err.message : String(err)
      });
    }
  }

  let effectiveRecruitmentId = rid;
  if (!effectiveRecruitmentId && result.draft && result.draft.draft) {
    effectiveRecruitmentId = parsePositiveId(result.draft.draft.recruitment_id);
  }
  if (!eid && result.draft && result.draft.draft) {
    eid = parsePositiveId(result.draft.draft.recruitment_event_id);
  }

  if (pageId && effectiveRecruitmentId) {
    try {
      const linked = await recruitmentPageLinkService.linkPage({
        page_id: pageId,
        recruitment_id: effectiveRecruitmentId,
        recruitment_event_id: eid
      });
      result.linkage = { skipped: false, linked };
    } catch (err) {
      result.ok = false;
      result.errors.push({ step: "page_linkage", message: err.message });
      logger.warn("atomic-publish: page linkage failed", {
        pageId,
        recruitmentId: effectiveRecruitmentId,
        message: err && err.message ? err.message : String(err)
      });
    }
  } else {
    result.linkage = { skipped: true, reason: "no_recruitment_or_page" };
  }

  if (eid) {
    try {
      const event = await recruitmentEventService.getRecruitmentEvent(eid);
      if (event && String(event.status || "").toLowerCase() === "pending") {
        const updated = await recruitmentEventService.updateRecruitmentEvent(eid, {
          status: "active"
        });
        result.event = { skipped: false, activated: true, event: updated };
      } else if (event) {
        result.event = { skipped: false, activated: false, event };
      } else {
        result.event = { skipped: true, reason: "event_not_found" };
      }
    } catch (err) {
      result.ok = false;
      result.errors.push({ step: "event_activate", message: err.message });
      logger.warn("atomic-publish: event activate failed", {
        eventId: eid,
        message: err && err.message ? err.message : String(err)
      });
    }
  } else {
    result.event = { skipped: true, reason: "no_event" };
  }

  let stageType = eventType;
  if (!stageType && result.event && result.event.event) {
    stageType = result.event.event.event_type;
  }
  if (effectiveRecruitmentId && stageType) {
    result.stage = await projectRecruitmentStageFromEvent({
      recruitmentId: effectiveRecruitmentId,
      eventType: stageType
    });
    if (result.stage && result.stage.skipped === true && result.stage.reason !== "unmapped_stage") {
      // non-fatal for unmapped; other failures already logged
    }
  } else {
    result.stage = { skipped: true, reason: "no_stage_context" };
  }

  if (author) {
    /* author reserved for future audit enrichment */
  }

  return result;
}

function isLifecycleUpdateEvent(eventType) {
  const type = normalizeEventType(eventType);
  return isDownstreamEvent(type) || type === "correction" || type === "exam_date";
}

function isAnnouncementCreateEvent(eventType) {
  return isAnnouncementEvent(eventType);
}

module.exports = {
  parsePositiveId,
  projectRecruitmentStageFromEvent,
  finalizeLifecyclePublish,
  isLifecycleUpdateEvent,
  isAnnouncementCreateEvent
};
