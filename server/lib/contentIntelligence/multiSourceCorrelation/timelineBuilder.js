"use strict";

/**
 * CIP Stage 3D — deterministic recruitment document timeline.
 *
 * Ordering rules (fully deterministic):
 *   1. Both documents dated  → earlier date first.
 *   2. Ties / undated pairs  → lifecycle role precedence
 *      (short notice → notification → … → joining notice).
 *   3. Remaining ties        → original input order.
 */

const { ROLE_TIMELINE_PRECEDENCE } = require("./correlationTypes");
const { isoDateMs } = require("./correlationUtils");

/** Role-specific important-date field consulted before generic fallbacks. */
const ROLE_DATE_FIELDS = Object.freeze({
  notification: "notificationDate",
  short_notice: "notificationDate",
  detailed_advertisement: "notificationDate",
  corrigendum: "notificationDate",
  exam_schedule: "examDate",
  admit_card: "admitCardDate",
  answer_key: "answerKeyDate",
  result: "resultDate",
  merit_list: "resultDate",
  cutoff: "resultDate"
});

/** Resolve the best deterministic date for a document view. */
function resolveTimelineDate(view) {
  const dates = view.evidence.importantDates || {};
  const documentDates = view.evidence.documentDates || {};

  const roleField = ROLE_DATE_FIELDS[view.role];
  const candidates = [
    roleField ? [`importantDates.${roleField}`, dates[roleField]] : null,
    ["importantDates.notificationDate", dates.notificationDate],
    ["metadata.modificationDate", documentDates.modificationDate],
    ["metadata.creationDate", documentDates.creationDate]
  ].filter(Boolean);

  for (const [source, value] of candidates) {
    const ms = isoDateMs(value);
    if (ms != null) {
      return { date: String(value).slice(0, 10), dateMs: ms, dateSource: source };
    }
  }
  return { date: null, dateMs: null, dateSource: null };
}

function compareTimelineEntries(a, b) {
  if (a.dateMs != null && b.dateMs != null && a.dateMs !== b.dateMs) {
    return a.dateMs - b.dateMs;
  }
  const pa = ROLE_TIMELINE_PRECEDENCE[a.role] ?? 999;
  const pb = ROLE_TIMELINE_PRECEDENCE[b.role] ?? 999;
  if (pa !== pb) return pa - pb;
  return a.inputIndex - b.inputIndex;
}

/**
 * Build the chronological document timeline for a set of correlated views.
 * @param {Array} views Document views belonging to one recruitment.
 */
function buildTimeline(views) {
  const entries = views.map((view) => {
    const resolved = resolveTimelineDate(view);
    return {
      documentId: view.documentId,
      inputIndex: view.inputIndex,
      role: view.role,
      roleLabel: view.roleLabel,
      title: view.title,
      date: resolved.date,
      dateMs: resolved.dateMs,
      dateSource: resolved.dateSource
    };
  });

  entries.sort(compareTimelineEntries);

  return entries.map((entry, index) => ({
    position: index + 1,
    documentId: entry.documentId,
    role: entry.role,
    roleLabel: entry.roleLabel,
    title: entry.title,
    date: entry.date,
    dateSource: entry.dateSource
  }));
}

module.exports = {
  ROLE_DATE_FIELDS,
  resolveTimelineDate,
  buildTimeline
};
