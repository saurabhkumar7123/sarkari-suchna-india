'use strict';

/**
 * AMP-1 — Timeline Builder
 *
 * Constructs deterministic recruitment timeline from history and notifications.
 */

const { deepFreeze, pickString } = require('./utils');
const { createTimelineEntry } = require('./recruitmentObjectModel');
const { STAGE_BY_ID } = require('./lifecycleIntelligence');

const TIMELINE_BUILDER_VERSION = 'AMP1.1.0.0';

function buildTimeline(input = {}) {
  const history = Array.isArray(input.history) ? input.history : [];
  const importantDates = Array.isArray(input.importantDates) ? input.importantDates : [];
  const entries = [];

  for (let i = 0; i < history.length; i += 1) {
    const event = history[i];
    const stage = pickString(event.stage);
    const stageMeta = STAGE_BY_ID[stage];
    entries.push(
      createTimelineEntry({
        stage,
        eventType: event.eventType,
        label: stageMeta ? stageMeta.label : stage,
        date: event.detectedAt || null,
        url: event.url || event.pdfUrl || null,
        order: stageMeta ? stageMeta.order : 0,
        source: event.source || 'history',
      })
    );
  }

  for (let i = 0; i < importantDates.length; i += 1) {
    const dateEntry = importantDates[i];
    if (!dateEntry || typeof dateEntry !== 'object') continue;
    entries.push(
      createTimelineEntry({
        stage: 'important_date',
        eventType: null,
        label: pickString(dateEntry.label) || 'Important Date',
        date: pickString(dateEntry.date) || null,
        url: null,
        order: 5,
        source: 'extracted',
      })
    );
  }

  entries.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const dateA = a.date ? Date.parse(a.date) : 0;
    const dateB = b.date ? Date.parse(b.date) : 0;
    return dateA - dateB;
  });

  const stageSequence = [];
  for (let i = 0; i < entries.length; i += 1) {
    const stage = entries[i].stage;
    if (stage && stage !== 'important_date' && !stageSequence.includes(stage)) {
      stageSequence.push(stage);
    }
  }

  return deepFreeze({
    version: TIMELINE_BUILDER_VERSION,
    timeline: entries,
    stageSequence,
    entryCount: entries.length,
    complete: stageSequence.length >= 2,
  });
}

module.exports = {
  TIMELINE_BUILDER_VERSION,
  buildTimeline,
};
