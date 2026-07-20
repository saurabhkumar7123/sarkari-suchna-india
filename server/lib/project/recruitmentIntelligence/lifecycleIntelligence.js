'use strict';

/**
 * AMP-1 — Lifecycle Intelligence
 *
 * Understands every recruitment stage, detects current/previous/next/missing stages.
 */

const { deepFreeze, normalizeText, pickString } = require('./utils');

const LIFECYCLE_INTELLIGENCE_VERSION = 'AMP1.1.0.0';

const STAGE_IDS = Object.freeze([
  'vacancy',
  'short_notice',
  'detailed_notification',
  'correction',
  'last_date_extension',
  'exam_date',
  'city_intimation',
  'admit_card',
  'answer_key',
  'objection',
  'result',
  'dv',
  'medical',
  'final_result',
  'waiting_list',
  'counselling',
  'joining',
  'closed',
  'cancelled',
]);

const STAGE_CATALOG = deepFreeze(
  STAGE_IDS.map((id, index) => {
    const descriptors = {
      vacancy: { eventType: 'notification', label: 'Vacancy', order: 10, group: 'announcement' },
      short_notice: { eventType: 'short_notification', label: 'Short Notice', order: 12, group: 'announcement' },
      detailed_notification: { eventType: 'notification', label: 'Detailed Notification', order: 15, group: 'announcement' },
      correction: { eventType: 'correction', label: 'Correction', order: 20, group: 'correction' },
      last_date_extension: { eventType: 'correction', label: 'Last Date Extension', order: 22, group: 'correction' },
      exam_date: { eventType: 'exam_date', label: 'Exam Date', order: 30, group: 'examination' },
      city_intimation: { eventType: 'city_intimation', label: 'City Intimation', order: 35, group: 'examination' },
      admit_card: { eventType: 'admit_card', label: 'Admit Card', order: 40, group: 'examination' },
      answer_key: { eventType: 'answer_key', label: 'Answer Key', order: 50, group: 'post_examination' },
      objection: { eventType: 'objection', label: 'Objection', order: 55, group: 'post_examination' },
      result: { eventType: 'result', label: 'Result', order: 60, group: 'results' },
      dv: { eventType: 'dv', label: 'Document Verification', order: 70, group: 'verification' },
      medical: { eventType: 'medical', label: 'Medical', order: 75, group: 'verification' },
      final_result: { eventType: 'final_result', label: 'Final Result', order: 80, group: 'results' },
      waiting_list: { eventType: 'result', label: 'Waiting List', order: 82, group: 'results' },
      counselling: { eventType: 'joining', label: 'Counselling', order: 85, group: 'completion' },
      joining: { eventType: 'joining', label: 'Joining', order: 90, group: 'completion' },
      closed: { eventType: null, label: 'Closed', order: 95, group: 'completion', terminal: true },
      cancelled: { eventType: null, label: 'Cancelled', order: 99, group: 'completion', terminal: true },
    };
    const d = descriptors[id];
    return Object.freeze({
      id,
      eventType: d.eventType,
      label: d.label,
      order: d.order,
      group: d.group,
      terminal: d.terminal === true,
    });
  })
);

const STAGE_BY_ID = Object.freeze(
  STAGE_CATALOG.reduce((acc, stage) => {
    acc[stage.id] = stage;
    return acc;
  }, Object.create(null))
);

const CLASSIFICATION_RULES = Object.freeze([
  { stage: 'cancelled', patterns: [/\bcancel+ed\b/, /\babandoned\b/, /\bwithdrawn\b/], confidence: 'high' },
  { stage: 'closed', patterns: [/\brecruitment\s+closed\b/, /\bprocess\s+completed\b/], confidence: 'high' },
  { stage: 'correction', patterns: [/\bcorrigendum\b/, /\bcorrig\b/, /\berrata\b/], confidence: 'high' },
  { stage: 'last_date_extension', patterns: [/\blast\s+date\s+extend/, /\bextension\s+of\s+last\s+date\b/], confidence: 'high' },
  { stage: 'final_result', patterns: [/\bfinal\s+result\b/, /\bfinal\s+merit\b/, /\bfinal\s+selection\b/], confidence: 'high' },
  { stage: 'waiting_list', patterns: [/\bwaiting\s+list\b/, /\bwait\s+list\b/], confidence: 'high' },
  { stage: 'counselling', patterns: [/\bcounselling\b/, /\bcounseling\b/], confidence: 'high' },
  { stage: 'joining', patterns: [/\bjoining\b/, /\bappointment\s+letter\b/], confidence: 'high' },
  { stage: 'medical', patterns: [/\bmedical\s+exam/, /\bmedical\s+test\b/, /\bfitness\s+test\b/], confidence: 'high' },
  { stage: 'dv', patterns: [/\bdocument\s+verification\b/, /\bdv\b/, /\bdoc\s*verif/], confidence: 'high' },
  { stage: 'objection', patterns: [/\bobjection\b/, /\bchallenge\s+answer\b/], confidence: 'high' },
  { stage: 'answer_key', patterns: [/\banswer\s+key\b/, /\bprovisional\s+key\b/], confidence: 'high' },
  { stage: 'admit_card', patterns: [/\badmit\s+card\b/, /\bhall\s+ticket\b/, /\bcall\s+letter\b/], confidence: 'high' },
  { stage: 'city_intimation', patterns: [/\bcity\s+intimation\b/, /\bexam\s+city\b/, /\bcentre\s+intimation\b/], confidence: 'high' },
  { stage: 'exam_date', patterns: [/\bexam\s+date\b/, /\bschedule\s+of\s+exam\b/, /\bdate\s+of\s+exam\b/], confidence: 'high' },
  { stage: 'short_notice', patterns: [/\bshort\s+notification\b/, /\bshort\s+notice\b/, /\bemployment\s+notice\b/], confidence: 'high' },
  { stage: 'result', patterns: [/\bresult\b/, /\bmerit\s+list\b/, /\bscore\s+card\b/], confidence: 'medium' },
  { stage: 'detailed_notification', patterns: [/\bdetailed\s+notification\b/, /\bfull\s+notification\b/], confidence: 'high' },
  { stage: 'vacancy', patterns: [/\bnotification\b/, /\badvertisement\b/, /\brecruitment\b/, /\bvacancy\b/], confidence: 'low' },
]);

function classifyStageFromNotification(notification = {}) {
  const text = normalizeText(
    [notification.title, notification.content, notification.url].filter(Boolean).join(' ')
  );
  let best = { stage: 'vacancy', confidence: 'none', matchedRules: [] };

  for (let i = 0; i < CLASSIFICATION_RULES.length; i += 1) {
    const rule = CLASSIFICATION_RULES[i];
    for (let j = 0; j < rule.patterns.length; j += 1) {
      if (rule.patterns[j].test(text)) {
        const precedence = STAGE_BY_ID[rule.stage].order;
        const bestPrecedence = STAGE_BY_ID[best.stage].order;
        if (
          best.confidence === 'none' ||
          precedence > bestPrecedence ||
          (precedence === bestPrecedence && rule.confidence === 'high' && best.confidence !== 'high')
        ) {
          best = {
            stage: rule.stage,
            confidence: rule.confidence,
            matchedRules: [rule.stage],
          };
        } else {
          best.matchedRules.push(rule.stage);
        }
        break;
      }
    }
  }

  if (notification.eventType) {
    const mapped = mapEventTypeToStage(notification.eventType);
    if (mapped) {
      best = { stage: mapped, confidence: 'high', matchedRules: [`eventType:${notification.eventType}`] };
    }
  }

  return deepFreeze({
    stage: best.stage,
    confidence: best.confidence,
    matchedRules: best.matchedRules,
    normalizedText: text,
  });
}

function mapEventTypeToStage(eventType) {
  const map = {
    notification: 'detailed_notification',
    short_notification: 'short_notice',
    correction: 'correction',
    exam_date: 'exam_date',
    city_intimation: 'city_intimation',
    admit_card: 'admit_card',
    answer_key: 'answer_key',
    objection: 'objection',
    result: 'result',
    final_result: 'final_result',
    dv: 'dv',
    medical: 'medical',
    joining: 'joining',
  };
  return map[pickString(eventType)] || null;
}

function detectStageContext(observedStages = [], currentStage = null) {
  const observed = [];
  const seen = Object.create(null);
  for (let i = 0; i < observedStages.length; i += 1) {
    const stage = observedStages[i];
    if (STAGE_BY_ID[stage] && !seen[stage]) {
      seen[stage] = true;
      observed.push(stage);
    }
  }

  const current = currentStage && STAGE_BY_ID[currentStage] ? currentStage : observed[observed.length - 1] || null;
  const currentOrder = current ? STAGE_BY_ID[current].order : -1;

  let previousStage = null;
  const currentIndex = observed.indexOf(current);
  if (currentIndex > 0) {
    previousStage = observed[currentIndex - 1];
  } else if (currentIndex === -1 && observed.length > 0) {
    previousStage = observed[observed.length - 1];
  }

  const possibleNextStages = STAGE_CATALOG.filter(
    (s) => !s.terminal && s.order > currentOrder && !observed.includes(s.id)
  ).map((s) => s.id);

  const missingStages = STAGE_CATALOG.filter(
    (s) => !s.terminal && s.order < currentOrder && !observed.includes(s.id)
  ).map((s) => s.id);

  return deepFreeze({
    currentStage: current,
    previousStage,
    possibleNextStages,
    missingStages,
    observedStages: observed,
  });
}

function listAllStages() {
  return STAGE_CATALOG;
}

module.exports = {
  LIFECYCLE_INTELLIGENCE_VERSION,
  STAGE_IDS,
  STAGE_CATALOG,
  STAGE_BY_ID,
  classifyStageFromNotification,
  mapEventTypeToStage,
  detectStageContext,
  listAllStages,
};
