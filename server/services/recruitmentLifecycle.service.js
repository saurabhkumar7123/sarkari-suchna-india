"use strict";

/**
 * Production lifecycle operations: attach, events, needs-matching resolution,
 * manual updates, announcement recruitment create.
 *
 * Never publishes. AUTO_PUBLISH remains false.
 */

const logger = require("../utils/logger");
const recruitmentService = require("./recruitment.service");
const recruitmentEventService = require("./recruitmentEvent.service");
const recruitmentUpdateLinkService = require("./recruitmentUpdateLink.service");
const generatorDraftService = require("./generatorDraft.service");
const recruitmentReviewService = require("./recruitmentReview.service");
const { extractRecruitmentAttributes } = require("../lib/recruitment/recruitmentMatcher");
const {
  isLifecycleEventType
} = require("../lib/recruitment/recruitmentDomainModel");
const {
  normalizeEventType,
  isAnnouncementEvent,
  evaluateRecruitmentCreation
} = require("../lib/recruitment/lifecycleSafety");
const { resolvePublishPolicy } = require("../lib/recruitment/lifecyclePublishPolicy");
const { lookupPageCandidatesForRuntime } = require("./pageCandidateLookup.service");

const EVENT_SEQUENCE = Object.freeze({
  notification: 10,
  short_notification: 12,
  correction: 20,
  exam_date: 30,
  city_intimation: 35,
  admit_card: 40,
  answer_key: 50,
  objection: 55,
  result: 60,
  final_result: 70,
  dv: 80,
  medical: 85,
  joining: 90
});

function slugFromTitle(title) {
  return String(title || "recruitment")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "recruitment";
}

function isSparseSystemDraft(draft) {
  if (!draft || String(draft.status) !== "draft") return false;
  const payload = draft.payload && typeof draft.payload === "object" ? draft.payload : {};
  const data = String(payload.data || payload.content || "").trim();
  const title = String(payload.title || draft.title || "").trim();
  if (payload.revisesDraftId) return false;
  // Treat short auto-seeded section text as sparse/system.
  if (data.length <= 180 && /\[Section:\s*Short Information\]/i.test(data)) return true;
  if (!data && title.length < 80) return true;
  return false;
}

/**
 * Persist a typed lifecycle event.
 *
 * @param {{
 *   recruitmentId: number,
 *   eventType: string,
 *   revision?: boolean,
 *   reuseIfActive?: boolean
 * }} input
 *
 * - First occurrence of a stage → create active event
 * - Same stage correction (revision=true) → supersede prior active, create new
 * - Default attach without revision → reuse active same-type event when present
 */
async function persistTypedEvent({
  recruitmentId,
  eventType,
  revision = false,
  reuseIfActive = true
} = {}) {
  const type = normalizeEventType(eventType);
  if (!isLifecycleEventType(type)) {
    return { skipped: true, reason: "unclassified_event" };
  }
  if (!recruitmentId) {
    return { skipped: true, reason: "no_recruitment" };
  }

  let existingEvents = [];
  try {
    const listed = await recruitmentEventService.listRecruitmentEvents({
      recruitment_id: recruitmentId,
      page: 1,
      limit: 100
    });
    existingEvents = Array.isArray(listed.data) ? listed.data : [];
  } catch (err) {
    logger.warn("lifecycle: list events failed", { message: err && err.message });
    return { skipped: true, reason: "events_unavailable" };
  }

  const sameType = existingEvents.filter((row) => row && row.event_type === type);
  const newestSame = sameType[0] || null;

  if (newestSame && newestSame.status === "active" && reuseIfActive && revision !== true) {
    return { skipped: false, reused: true, revised: false, event: newestSame };
  }

  if (newestSame && newestSame.status === "active" && revision === true) {
    try {
      await recruitmentEventService.updateRecruitmentEvent(newestSame.id, {
        status: "superseded"
      });
    } catch (err) {
      logger.warn("lifecycle: supersede event failed", {
        eventId: newestSame.id,
        message: err && err.message ? err.message : String(err)
      });
      return { skipped: true, reason: "supersede_failed" };
    }
  }

  const sequence = EVENT_SEQUENCE[type] != null ? EVENT_SEQUENCE[type] : 0;
  try {
    const created = await recruitmentEventService.createRecruitmentEvent({
      recruitment_id: recruitmentId,
      event_type: type,
      sequence_order: sequence,
      status: "active"
    });
    return {
      skipped: false,
      reused: false,
      revised: Boolean(newestSame && revision === true),
      supersededEventId: newestSame && revision === true ? newestSame.id : null,
      event: created
    };
  } catch (err) {
    logger.warn("lifecycle: create event failed", { message: err && err.message });
    return { skipped: true, reason: err && err.message ? err.message : "create_event_failed" };
  }
}

async function persistUpdateLinkage({ updateId, recruitmentId, recruitmentEventId }) {
  if (!updateId || !recruitmentId) {
    return { skipped: true, reason: "missing_ids" };
  }
  try {
    const linked = await recruitmentUpdateLinkService.linkUpdate({
      update_id: updateId,
      recruitment_id: recruitmentId,
      recruitment_event_id: recruitmentEventId || null
    });
    return { skipped: false, linked };
  } catch (err) {
    logger.warn("lifecycle: update linkage failed", { message: err && err.message });
    return { skipped: true, reason: err && err.message ? err.message : "linkage_failed" };
  }
}

async function persistStrongMatchLinkage({
  updateId,
  recruitmentId,
  eventType,
  draftId,
  reviewId,
  revision = false
}) {
  if (!recruitmentId) {
    return { recruitmentEventId: null, updateLinked: false };
  }

  const eventResult = await persistTypedEvent({
    recruitmentId,
    eventType,
    revision: revision === true,
    reuseIfActive: revision !== true
  });
  const recruitmentEventId =
    eventResult && eventResult.event && eventResult.event.id ? eventResult.event.id : null;

  const updateLink = await persistUpdateLinkage({
    updateId,
    recruitmentId,
    recruitmentEventId
  });

  if (draftId) {
    await applyParentToDraftAndReview({
      recruitmentId,
      recruitmentEventId,
      updateId: null,
      draftId,
      reviewId: null
    });
  }

  if (reviewId && typeof recruitmentReviewService.bindReviewItemRecruitment === "function") {
    try {
      await recruitmentReviewService.bindReviewItemRecruitment(
        reviewId,
        recruitmentId,
        recruitmentEventId
      );
    } catch (err) {
      logger.warn("lifecycle: review bind failed", { message: err && err.message });
    }
  }

  return {
    recruitmentEventId,
    updateLinked: updateLink.skipped !== true,
    event: eventResult.event || null
  };
}

async function createHumanApprovedRecruitment({ notice, eventType } = {}) {
  const attrs = extractRecruitmentAttributes(notice || {});
  const title = String((notice && notice.title) || attrs.examName || "Recruitment").trim();
  const slugBase = slugFromTitle(
    [attrs.organization, attrs.examName || attrs.postName, attrs.recruitmentYear, title]
      .filter(Boolean)
      .join(" ")
  );

  try {
    const recruitment = await recruitmentService.createRecruitment({
      title,
      slug: `${slugBase}-${Date.now().toString(36).slice(-4)}`,
      department: attrs.organization || attrs.department || (notice && notice.organization) || null,
      post_name: attrs.examName || attrs.postName || (notice && notice.postName) || null,
      advertisement_no: attrs.advertisementNo || (notice && notice.advertisementNo) || null,
      cycle_year: attrs.recruitmentYear || null,
      lifecycle_state: "announced"
    });
    return { created: true, reason: "human_approved_create", recruitment };
  } catch (err) {
    logger.warn("lifecycle: human-approved recruitment create failed", {
      message: err && err.message
    });
    return {
      created: false,
      reason: err && err.message ? err.message : "create_failed",
      recruitment: null
    };
  }
}

async function createAnnouncementRecruitment({ notice, eventType, matchLevel, identity }) {
  const creation = evaluateRecruitmentCreation({ eventType, matchLevel, identity });
  if (!creation.allowed) {
    return { created: false, reason: creation.reason, recruitment: null };
  }

  const attrs = identity || extractRecruitmentAttributes(notice || {});
  const title = String((notice && notice.title) || attrs.examName || "Recruitment").trim();
  const slugBase = slugFromTitle(
    [attrs.organization, attrs.examName || attrs.postName, attrs.recruitmentYear, title]
      .filter(Boolean)
      .join(" ")
  );

  try {
    const recruitment = await recruitmentService.createRecruitment({
      title,
      slug: `${slugBase}-${Date.now().toString(36).slice(-4)}`,
      department: attrs.organization || attrs.department || null,
      post_name: attrs.examName || attrs.postName || null,
      advertisement_no: attrs.advertisementNo || null,
      cycle_year: attrs.recruitmentYear || null,
      lifecycle_state: "announced"
    });
    return { created: true, reason: creation.reason, recruitment };
  } catch (err) {
    logger.warn("lifecycle: announcement recruitment create failed", {
      message: err && err.message
    });
    return {
      created: false,
      reason: err && err.message ? err.message : "create_failed",
      recruitment: null
    };
  }
}

async function applyParentToDraftAndReview({
  recruitmentId,
  recruitmentEventId,
  updateId,
  draftId,
  reviewId
}) {
  if (draftId && recruitmentId) {
    try {
      // Use linkage-only bind so ATTACH works even when
      // RECRUITMENT_LIFECYCLE_EDITORIAL_ATTACHMENT_ENABLED is false.
      if (typeof generatorDraftService.bindDraftRecruitmentLinkage === "function") {
        await generatorDraftService.bindDraftRecruitmentLinkage(draftId, {
          recruitmentId,
          recruitmentEventId
        });
      } else {
        const existing = await generatorDraftService.getDraftById(draftId);
        if (existing && String(existing.status) === "draft") {
          await generatorDraftService.saveDraft({
            id: draftId,
            payload: existing.payload || { title: existing.title },
            recruitmentId,
            recruitmentEventId
          });
        }
      }
    } catch (err) {
      logger.warn("lifecycle: draft rebind failed", { message: err && err.message });
    }
  }

  if (reviewId && recruitmentId) {
    try {
      await recruitmentReviewService.bindReviewItemRecruitment(
        reviewId,
        recruitmentId,
        recruitmentEventId
      );
    } catch (err) {
      logger.warn("lifecycle: review rebind failed", { message: err && err.message });
    }
  }

  if (updateId && recruitmentId) {
    await persistUpdateLinkage({ updateId, recruitmentId, recruitmentEventId });
  }
}

/**
 * Human resolution for Needs Matching.
 * action: attach | create_parent | standalone | reject
 */
async function resolveNeedsMatching({
  reviewId,
  action,
  recruitmentId,
  notice,
  eventType,
  notes
} = {}) {
  const review = await recruitmentReviewService.getReviewItemById(reviewId);
  if (!review) {
    const err = new Error("Review item not found");
    err.statusCode = 404;
    throw err;
  }

  const chosen = String(action || "").toLowerCase();
  const updateId = review.update_id;
  const processor = review.processor_output && typeof review.processor_output === "object"
    ? review.processor_output
    : {};
  const draftId = processor.draftId || null;

  if (chosen === "standalone") {
    await recruitmentReviewService.updateReviewDecision(reviewId, {
      decision: "skip",
      notes: notes || "Human left update standalone"
    });
    return { ok: true, action: "standalone", recruitmentId: null };
  }

  if (chosen === "reject") {
    await recruitmentReviewService.updateReviewDecision(reviewId, {
      decision: "reject",
      notes: notes || "Human rejected needs-matching item"
    });
    return { ok: true, action: "reject", recruitmentId: null };
  }

  let parentId = recruitmentId ? Number(recruitmentId) : null;

  if (chosen === "create_parent") {
    const created = await createHumanApprovedRecruitment({
      notice: notice || review.raw_notice || { title: review.title },
      eventType: eventType || review.event_type || "notification"
    });
    if (!created.created || !created.recruitment) {
      const err = new Error(created.reason || "Could not create parent recruitment");
      err.statusCode = 400;
      throw err;
    }
    parentId = created.recruitment.id;
  }

  if (chosen === "attach" || chosen === "create_parent") {
    if (!parentId) {
      const err = new Error("recruitment_id is required to attach");
      err.statusCode = 400;
      throw err;
    }
    const eventResult = await persistTypedEvent({
      recruitmentId: parentId,
      eventType: eventType || review.event_type
    });
    const recruitmentEventId =
      eventResult && eventResult.event && eventResult.event.id ? eventResult.event.id : null;
    await applyParentToDraftAndReview({
      recruitmentId: parentId,
      recruitmentEventId,
      updateId,
      draftId,
      reviewId
    });
    await recruitmentReviewService.updateReviewDecision(reviewId, {
      decision: "skip",
      notes: notes || `Attached to recruitment ${parentId}`
    });
    return { ok: true, action: chosen, recruitmentId: parentId, recruitmentEventId };
  }

  const err = new Error("Invalid needs-matching action");
  err.statusCode = 400;
  throw err;
}

async function createManualRecruitmentUpdate({
  recruitmentId,
  eventType,
  title,
  payload
} = {}) {
  const parent = Number(recruitmentId);
  if (!Number.isFinite(parent) || parent <= 0) {
    const err = new Error("recruitment_id is required");
    err.statusCode = 400;
    throw err;
  }
  await recruitmentService.getRecruitment(parent);

  const type = normalizeEventType(eventType);
  if (isAnnouncementEvent(type) === false && type === "unknown") {
    const err = new Error("event_type is required");
    err.statusCode = 400;
    throw err;
  }

  const eventResult = await persistTypedEvent({
    recruitmentId: parent,
    eventType: type,
    revision: true,
    reuseIfActive: false
  });
  const recruitmentEventId =
    eventResult && eventResult.event && eventResult.event.id ? eventResult.event.id : null;

  // One active unpublished draft per recruitment+event occurrence:
  // reuse empty/system draft only; never overwrite human-edited content silently.
  let existingUnpublished = null;
  if (
    recruitmentEventId &&
    typeof generatorDraftService.findUnpublishedDraftForEventOccurrence === "function"
  ) {
    try {
      existingUnpublished = await generatorDraftService.findUnpublishedDraftForEventOccurrence({
        recruitmentId: parent,
        recruitmentEventId
      });
    } catch {
      existingUnpublished = null;
    }
  }

  const draftPayload =
    payload && typeof payload === "object"
      ? { ...payload, title: payload.title || title }
      : {
          title: title || `${type} update`,
          data: `[Section: Short Information]\n${title || type}`
        };

  let draft;
  if (
    existingUnpublished &&
    existingUnpublished.id &&
    isSparseSystemDraft(existingUnpublished)
  ) {
    draft = await generatorDraftService.saveDraft({
      id: existingUnpublished.id,
      payload: draftPayload,
      recruitmentId: parent,
      recruitmentEventId
    });
  } else if (existingUnpublished && existingUnpublished.id) {
    // Preserve human-edited draft; create a revision draft instead.
    draft = await generatorDraftService.saveDraft({
      payload: {
        ...draftPayload,
        title: `${draftPayload.title || type} (revision)`,
        revisesDraftId: existingUnpublished.id
      },
      recruitmentId: parent,
      recruitmentEventId
    });
  } else {
    draft = await generatorDraftService.saveDraft({
      payload: draftPayload,
      recruitmentId: parent,
      recruitmentEventId
    });
  }

  const review = await recruitmentReviewService.saveReviewItem({
    reviewItem: {
      recruitmentId: parent,
      eventType: type === "unknown" ? "unknown" : type,
      confidence: "high",
      sourceUrl: draftPayload.pageUrl || null,
      title: draft.title
    },
    processorOutput: {
      draftId: draft.id,
      origin: "manual",
      publishPolicy: resolvePublishPolicy(type)
    }
  });

  return {
    recruitmentId: parent,
    recruitmentEventId,
    draft,
    review,
    publishPolicy: resolvePublishPolicy(type)
  };
}

module.exports = {
  lookupPageCandidatesForRuntime,
  persistTypedEvent,
  persistUpdateLinkage,
  persistStrongMatchLinkage,
  createAnnouncementRecruitment,
  createHumanApprovedRecruitment,
  resolveNeedsMatching,
  createManualRecruitmentUpdate,
  applyParentToDraftAndReview
};
