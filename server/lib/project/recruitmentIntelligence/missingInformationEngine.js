'use strict';

/**
 * AMP-1 — Missing Information Engine
 *
 * Detects missing dates, links, PDFs, eligibility, age, vacancy, fees, selection, etc.
 */

const { deepFreeze, pickString } = require('./utils');

const MISSING_INFO_CODES = Object.freeze({
  MISSING_RECRUITMENT_NAME: 'MISSING_RECRUITMENT_NAME',
  MISSING_ADVERTISEMENT_NUMBER: 'MISSING_ADVERTISEMENT_NUMBER',
  MISSING_ORGANIZATION: 'MISSING_ORGANIZATION',
  MISSING_DEPARTMENT: 'MISSING_DEPARTMENT',
  MISSING_OFFICIAL_WEBSITE: 'MISSING_OFFICIAL_WEBSITE',
  MISSING_OFFICIAL_NOTIFICATION: 'MISSING_OFFICIAL_NOTIFICATION',
  MISSING_DATES: 'MISSING_DATES',
  MISSING_LAST_DATE: 'MISSING_LAST_DATE',
  MISSING_LINKS: 'MISSING_LINKS',
  MISSING_PDF: 'MISSING_PDF',
  MISSING_ELIGIBILITY: 'MISSING_ELIGIBILITY',
  MISSING_AGE: 'MISSING_AGE',
  MISSING_VACANCY: 'MISSING_VACANCY',
  MISSING_FEE: 'MISSING_FEE',
  MISSING_SELECTION: 'MISSING_SELECTION',
  MISSING_TIMELINE: 'MISSING_TIMELINE',
});

function detectMissingInformation(recruitment = {}) {
  const missing = [];

  if (!pickString(recruitment.recruitmentName)) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_RECRUITMENT_NAME, severity: 'critical', field: 'recruitmentName' });
  }
  if (!pickString(recruitment.advertisementNumber)) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_ADVERTISEMENT_NUMBER, severity: 'high', field: 'advertisementNumber' });
  }
  if (!pickString(recruitment.organization)) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_ORGANIZATION, severity: 'medium', field: 'organization' });
  }
  if (!pickString(recruitment.department)) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_DEPARTMENT, severity: 'medium', field: 'department' });
  }
  if (!pickString(recruitment.officialWebsite)) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_OFFICIAL_WEBSITE, severity: 'medium', field: 'officialWebsite' });
  }
  if (!pickString(recruitment.officialNotification)) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_OFFICIAL_NOTIFICATION, severity: 'high', field: 'officialNotification' });
  }

  const dates = Array.isArray(recruitment.importantDates) ? recruitment.importantDates : [];
  if (!dates.length) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_DATES, severity: 'high', field: 'importantDates' });
  } else {
    const hasLastDate = dates.some((d) =>
      /last\s*date|closing|end/i.test(pickString(d.label))
    );
    if (!hasLastDate) {
      missing.push({ code: MISSING_INFO_CODES.MISSING_LAST_DATE, severity: 'medium', field: 'importantDates' });
    }
  }

  const links = Array.isArray(recruitment.importantLinks) ? recruitment.importantLinks : [];
  if (!links.length) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_LINKS, severity: 'medium', field: 'importantLinks' });
  }
  const hasPdf = links.some((l) => /\.pdf/i.test(pickString(l.url)));
  if (!hasPdf && !/\.pdf/i.test(pickString(recruitment.officialNotification))) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_PDF, severity: 'low', field: 'pdf' });
  }

  if (!pickString(recruitment.eligibility)) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_ELIGIBILITY, severity: 'high', field: 'eligibility' });
  }
  if (!pickString(recruitment.age)) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_AGE, severity: 'medium', field: 'age' });
  }
  if (!recruitment.vacancy || (!recruitment.vacancy.totalPosts && !pickString(recruitment.vacancy.postName))) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_VACANCY, severity: 'high', field: 'vacancy' });
  }
  if (!pickString(recruitment.fees)) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_FEE, severity: 'medium', field: 'fees' });
  }
  if (!pickString(recruitment.selectionProcess)) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_SELECTION, severity: 'high', field: 'selectionProcess' });
  }
  if (!Array.isArray(recruitment.timeline) || recruitment.timeline.length < 1) {
    missing.push({ code: MISSING_INFO_CODES.MISSING_TIMELINE, severity: 'low', field: 'timeline' });
  }

  const criticalCount = missing.filter((m) => m.severity === 'critical' || m.severity === 'high').length;

  return deepFreeze({
    missingInformation: missing,
    missingCount: missing.length,
    criticalCount,
    complete: missing.length === 0,
  });
}

module.exports = {
  MISSING_INFO_CODES,
  detectMissingInformation,
};
