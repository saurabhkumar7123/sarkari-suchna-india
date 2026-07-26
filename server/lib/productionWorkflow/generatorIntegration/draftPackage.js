"use strict";

/**
 * PWP Phase 3 — Deterministic Draft Package model.
 * Immutable after creation. Preparation only — no HTML, no publishing.
 */

const crypto = require("crypto");
const { deepFreeze } = require("../../contentIntelligence/multiSourceCorrelation/correlationUtils");
const { buildGeneratorDraftFromCanonical } = require("../contentAdapters");
const { RESOLUTION_DECISIONS } = require("../recruitmentResolution/resolutionTypes");
const {
  ENGINE_ID,
  ENGINE_VERSION,
  PHASE,
  DRAFT_PACKAGE_FORMAT_ID,
  DRAFT_TYPES
} = require("./integrationTypes");
const { buildEditorialNotes } = require("./editorialNotes");
const { buildUpdatePackage } = require("./updatePackage");

function collapseWhitespace(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function decisionToDraftType(decision) {
  switch (decision) {
    case RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT:
      return DRAFT_TYPES.FULL_RECRUITMENT_DRAFT;
    case RESOLUTION_DECISIONS.CREATE_NEW_PAGE:
      return DRAFT_TYPES.FULL_PAGE_DRAFT;
    case RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE:
      return DRAFT_TYPES.PAGE_UPDATE_DRAFT;
    case RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT:
      return DRAFT_TYPES.RECRUITMENT_METADATA_UPDATE;
    case RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED:
      return DRAFT_TYPES.REVIEW_ONLY;
    case RESOLUTION_DECISIONS.IGNORE_DUPLICATE:
    case RESOLUTION_DECISIONS.SUPERSEDED_DOCUMENT:
      return DRAFT_TYPES.NONE;
    default:
      return DRAFT_TYPES.NONE;
  }
}

/**
 * Deterministic draft id from stable inputs (no random).
 */
function createDraftId({ workflowId, decision, recruitmentId, draftType }) {
  const material = [
    workflowId || "",
    decision || "",
    recruitmentId == null ? "" : String(recruitmentId),
    draftType || ""
  ].join("|");
  const hash = crypto.createHash("sha256").update(material).digest("hex").slice(0, 16);
  return `pwp_draft_${hash}`;
}

function resolvePageReference(existingPageMetadata, existingPage, resolution) {
  const page = existingPageMetadata || existingPage || null;
  const pageMatch = resolution && resolution.pageMatch ? resolution.pageMatch : null;
  if (!page && !pageMatch) return null;

  const pageId =
    (page && (page.pageId || page.id)) ||
    (pageMatch && pageMatch.pageId) ||
    null;

  return Object.freeze({
    pageId,
    recruitmentId:
      (page && page.recruitmentId) ||
      (pageMatch && pageMatch.record && pageMatch.record.recruitmentId) ||
      null,
    sections: Object.freeze(
      (
        (page && (page.sections || page.pageSections)) ||
        (pageMatch && pageMatch.sections) ||
        []
      )
        .map((item) =>
          typeof item === "string"
            ? item
            : (item && (item.key || item.id || item.name || item.heading)) || null
        )
        .filter(Boolean)
    ),
    exists: page ? page.exists !== false : Boolean(pageMatch && pageMatch.matched)
  });
}

function buildChangeSummary(decision, updatePlan, updatePackage) {
  if (updatePackage && updatePackage.changeSummary) {
    return updatePackage.changeSummary;
  }
  if (updatePlan && updatePlan.changeSummary) {
    return updatePlan.changeSummary;
  }
  if (
    decision === RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT ||
    decision === RESOLUTION_DECISIONS.CREATE_NEW_PAGE
  ) {
    return Object.freeze({
      changeCount: 0,
      affectedSectionCount: 0,
      unaffectedSectionCount: 0,
      changeTypes: Object.freeze([]),
      details: Object.freeze([]),
      description:
        decision === RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT
          ? "New recruitment draft"
          : "New page draft"
    });
  }
  return null;
}

function buildGeneratorPayload({
  decision,
  draftType,
  canonicalRecruitmentPackage,
  workflowContext,
  workflowId,
  recruitmentId,
  updatePackage,
  resolution
}) {
  if (draftType === DRAFT_TYPES.NONE) return null;
  if (draftType === DRAFT_TYPES.REVIEW_ONLY) {
    return Object.freeze({
      status: "review_only",
      title:
        collapseWhitespace(
          (workflowContext &&
            workflowContext.monitoringEvent &&
            workflowContext.monitoringEvent.title) ||
            (workflowContext && workflowContext.title) ||
            (resolution && resolution.identity && resolution.identity.recruitmentName)
        ) || "Manual review required",
      data: "",
      workflowId,
      recruitmentId,
      resolutionDecision: decision,
      reviewOnly: true,
      canonicalRecruitmentPackage: canonicalRecruitmentPackage || null
    });
  }

  const event = (workflowContext && workflowContext.monitoringEvent) || {};
  const identity = (resolution && resolution.identity) || {};
  const base = buildGeneratorDraftFromCanonical(canonicalRecruitmentPackage, {
    workflowId,
    recruitmentId,
    sourceUrl: event.sourceUrl || event.url || null,
    title: event.title || identity.recruitmentName || null,
    postName: identity.postName || null,
    totalPosts: event.totalPosts || null,
    advertisementNo: identity.advertisementNumber || null
  });

  const payload = {
    ...base,
    resolutionDecision: decision,
    draftType,
    updatePlan: updatePackage || (resolution && resolution.updatePlan) || null
  };

  if (draftType === DRAFT_TYPES.PAGE_UPDATE_DRAFT && updatePackage) {
    payload.affectedSections = updatePackage.affectedSections.slice();
    payload.unaffectedSections = updatePackage.unaffectedSections.slice();
    payload.sectionActions = { ...updatePackage.sectionActions };
    // Scope generator text metadata only — no HTML; Generator renders supplied package.
    payload.updateScope = updatePackage.suggestedUpdateScope;
  }

  if (draftType === DRAFT_TYPES.RECRUITMENT_METADATA_UPDATE) {
    payload.metadataUpdateOnly = true;
    payload.data = ""; // metadata package — body not rewritten here
  }

  return Object.freeze(payload);
}

/**
 * Create an immutable Draft Package (or null for NONE outcomes when caller skips).
 */
function buildDraftPackage({
  decision,
  workflowContext = {},
  resolution = null,
  canonicalRecruitmentPackage = null,
  updatePlan = null,
  existingPageMetadata = null,
  existingPage = null,
  existingRecruitment = null,
  workflowId = null,
  recruitmentId = null,
  validationSummary = null,
  warnings = []
} = {}) {
  const draftType = decisionToDraftType(decision);
  if (draftType === DRAFT_TYPES.NONE) {
    return null;
  }

  const resolvedWorkflowId =
    workflowId ||
    (workflowContext && workflowContext.workflowId) ||
    (workflowContext &&
      workflowContext.monitoringEvent &&
      workflowContext.monitoringEvent.workflowId) ||
    null;

  const resolvedRecruitmentId =
    recruitmentId ||
    (resolution && resolution.match && resolution.match.recruitmentId) ||
    (existingRecruitment &&
      (existingRecruitment.recruitmentId || existingRecruitment.id)) ||
    (workflowContext && workflowContext.existingRecruitment &&
      (workflowContext.existingRecruitment.recruitmentId ||
        workflowContext.existingRecruitment.id)) ||
    null;

  const needsUpdatePackage =
    decision === RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE ||
    decision === RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT;

  const updatePackage = needsUpdatePackage
    ? buildUpdatePackage({
        updatePlan: updatePlan || (resolution && resolution.updatePlan) || null,
        existingPage: existingPage || (workflowContext && workflowContext.existingPage),
        existingPageMetadata:
          existingPageMetadata ||
          (workflowContext && workflowContext.existingPageMetadata) ||
          null
      })
    : null;

  const editorialNotes = buildEditorialNotes({
    decision,
    updatePlan: updatePlan || (updatePackage && updatePackage.sourceUpdatePlan) || null,
    workflowContext,
    existingRecruitment:
      existingRecruitment || (workflowContext && workflowContext.existingRecruitment) || null
  });

  const draftId = createDraftId({
    workflowId: resolvedWorkflowId,
    decision,
    recruitmentId: resolvedRecruitmentId,
    draftType
  });

  const generatorPayload = buildGeneratorPayload({
    decision,
    draftType,
    canonicalRecruitmentPackage,
    workflowContext,
    workflowId: resolvedWorkflowId,
    recruitmentId: resolvedRecruitmentId,
    updatePackage,
    resolution
  });

  const pageReference = resolvePageReference(
    existingPageMetadata,
    existingPage || (workflowContext && workflowContext.existingPage),
    resolution
  );

  const packageWarnings = Array.isArray(warnings) ? warnings.slice() : [];

  const draftPackage = {
    formatId: DRAFT_PACKAGE_FORMAT_ID,
    engineId: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    phase: PHASE,
    draftId,
    workflowId: resolvedWorkflowId,
    recruitmentId: resolvedRecruitmentId,
    decision,
    draftType,
    generatorPayload,
    updatePlan: updatePackage || updatePlan || (resolution && resolution.updatePlan) || null,
    updatePackage,
    pageReference,
    changeSummary: buildChangeSummary(decision, updatePlan, updatePackage),
    editorialNotes: Object.freeze(editorialNotes.slice()),
    warnings: Object.freeze(packageWarnings.map((w) => Object.freeze({ ...w }))),
    validationSummary: validationSummary || null,
    effects: Object.freeze({
      preparesPackage: true,
      rendersHtml: false,
      publishes: false,
      usesAi: false,
      modifiesPages: false,
      callsGenerator: draftType !== DRAFT_TYPES.REVIEW_ONLY
    }),
    createdAt: "deterministic",
    immutable: true
  };

  return deepFreeze(draftPackage);
}

module.exports = {
  decisionToDraftType,
  createDraftId,
  buildDraftPackage,
  buildGeneratorPayload,
  resolvePageReference
};
