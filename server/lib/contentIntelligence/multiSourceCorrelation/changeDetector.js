"use strict";

/**
 * CIP Stage 3D — deterministic change detection between related documents.
 *
 * Returns structured differences only. Never rewrites, merges, or interprets
 * content. A change is emitted only when the revised document declares a
 * concrete value that differs from the base document.
 */

const { CHANGE_TYPES } = require("./correlationTypes");
const { urlKey } = require("./correlationUtils");

const DATE_FIELD_CHANGE_TYPES = Object.freeze({
  notificationDate: CHANGE_TYPES.IMPORTANT_DATE,
  startDate: CHANGE_TYPES.IMPORTANT_DATE,
  lastDate: CHANGE_TYPES.IMPORTANT_DATE,
  examDate: CHANGE_TYPES.EXAM_SCHEDULE,
  resultDate: CHANGE_TYPES.IMPORTANT_DATE,
  admitCardDate: CHANGE_TYPES.IMPORTANT_DATE,
  answerKeyDate: CHANGE_TYPES.IMPORTANT_DATE
});

function makeChange(changeType, field, previousValue, currentValue, previousView, currentView) {
  return {
    changeType,
    field,
    previousValue: previousValue == null ? null : String(previousValue),
    currentValue: currentValue == null ? null : String(currentValue),
    previousDocumentId: previousView.documentId,
    currentDocumentId: currentView.documentId
  };
}

/**
 * Detect deterministic structured changes from `previousView` to `currentView`.
 *
 * @param {object} previousView Base document view (e.g. notification).
 * @param {object} currentView Revised/related document view (e.g. corrigendum).
 * @param {object} [options]
 * @param {boolean} [options.compareSections] Compare section heading sets;
 *   only meaningful for same-role document revisions.
 */
function detectChanges(previousView, currentView, options = {}) {
  const changes = [];
  const prevMeta = previousView.metadata || {};
  const currMeta = currentView.metadata || {};

  const prevDates = prevMeta.importantDates || {};
  const currDates = currMeta.importantDates || {};
  for (const [field, changeType] of Object.entries(DATE_FIELD_CHANGE_TYPES)) {
    const previous = prevDates[field] || null;
    const current = currDates[field] || null;
    if (current != null && current !== previous) {
      changes.push(
        makeChange(changeType, `importantDates.${field}`, previous, current, previousView, currentView)
      );
    }
  }

  if (
    currentView.totalPosts != null &&
    String(currentView.totalPosts) !== String(previousView.totalPosts ?? "")
  ) {
    changes.push(
      makeChange(
        CHANGE_TYPES.VACANCY_COUNT,
        "totalPosts",
        previousView.totalPosts ?? null,
        currentView.totalPosts,
        previousView,
        currentView
      )
    );
  }

  if (currMeta.qualification != null && currMeta.qualification !== prevMeta.qualification) {
    changes.push(
      makeChange(
        CHANGE_TYPES.ELIGIBILITY,
        "qualification",
        prevMeta.qualification ?? null,
        currMeta.qualification,
        previousView,
        currentView
      )
    );
  }

  if (currentView.applicationFee != null && currentView.applicationFee !== previousView.applicationFee) {
    changes.push(
      makeChange(
        CHANGE_TYPES.APPLICATION_FEE,
        "applicationFee",
        previousView.applicationFee,
        currentView.applicationFee,
        previousView,
        currentView
      )
    );
  }

  for (const field of ["officialWebsite", "notificationUrl"]) {
    const previous = prevMeta[field] || null;
    const current = currMeta[field] || null;
    // A document's own source URL is provenance, not an announced link change.
    const isOwnSourceUrl =
      current != null && urlKey(current) === urlKey(currentView.sourceUrl);
    if (current != null && !isOwnSourceUrl && urlKey(current) !== urlKey(previous)) {
      changes.push(
        makeChange(CHANGE_TYPES.OFFICIAL_LINK, field, previous, current, previousView, currentView)
      );
    }
  }

  const prevMarkers = previousView.revisionMarkers.join(",");
  const currMarkers = currentView.revisionMarkers.join(",");
  if (currentView.revisionMarkers.length && currMarkers !== prevMarkers) {
    changes.push(
      makeChange(
        CHANGE_TYPES.NOTIFICATION_VERSION,
        "revisionMarkers",
        prevMarkers || null,
        currMarkers,
        previousView,
        currentView
      )
    );
  }

  if (options.compareSections) {
    const prevSections = new Set(previousView.sections);
    const currSections = new Set(currentView.sections);
    for (const section of currentView.sections) {
      if (!prevSections.has(section)) {
        changes.push(
          makeChange(CHANGE_TYPES.SECTION_ADDED, "section", null, section, previousView, currentView)
        );
      }
    }
    for (const section of previousView.sections) {
      if (!currSections.has(section)) {
        changes.push(
          makeChange(CHANGE_TYPES.SECTION_REMOVED, "section", section, null, previousView, currentView)
        );
      }
    }
  }

  const prevRevision = previousView.evidence.documentDates.modificationDate || null;
  const currRevision = currentView.evidence.documentDates.modificationDate || null;
  if (currRevision != null && currRevision !== prevRevision) {
    changes.push(
      makeChange(
        CHANGE_TYPES.DOCUMENT_REVISION,
        "modificationDate",
        prevRevision,
        currRevision,
        previousView,
        currentView
      )
    );
  }

  changes.sort((a, b) => {
    const type = String(a.changeType).localeCompare(String(b.changeType));
    if (type !== 0) return type;
    const field = String(a.field).localeCompare(String(b.field));
    if (field !== 0) return field;
    return String(a.currentValue).localeCompare(String(b.currentValue));
  });
  return changes;
}

module.exports = {
  DATE_FIELD_CHANGE_TYPES,
  detectChanges
};
