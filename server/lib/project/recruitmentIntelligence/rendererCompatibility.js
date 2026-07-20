'use strict';

/**
 * AMP-1 — Renderer Compatibility
 *
 * Maps Recruitment Object to existing Generator section syntax.
 * NEVER generates HTML or CSS — structured sections only.
 */

const { deepFreeze, pickString } = require('./utils');

const RENDERER_COMPATIBILITY_VERSION = 'AMP1.1.0.0';

const CANONICAL_SECTIONS = Object.freeze({
  SHORT_INFORMATION: 'Short Information',
  IMPORTANT_DATES: 'Important Dates',
  ELIGIBILITY: 'Eligibility',
  APPLICATION_FEE: 'Application Fee',
  SELECTION_PROCESS: 'Selection Process',
  VACANCY_TABLE: 'Vacancy | table',
  IMPORTANT_LINKS: 'Important Links',
  IMPORTANT_QUESTIONS: 'Important Questions',
});

function formatImportantDates(dates) {
  if (!Array.isArray(dates)) return '';
  return dates
    .map((d) => {
      if (!d || typeof d !== 'object') return '';
      const label = pickString(d.label) || 'Date';
      const date = pickString(d.date) || '';
      return date ? `${label} : ${date}` : label;
    })
    .filter(Boolean)
    .join('\n');
}

function formatImportantLinks(links) {
  if (!Array.isArray(links)) return '';
  return links
    .map((l) => {
      if (!l || typeof l !== 'object') return '';
      const label = pickString(l.label) || 'Link';
      const url = pickString(l.url) || '';
      return url ? `${label} : ${url}` : label;
    })
    .filter(Boolean)
    .join('\n');
}

function formatVacancyTable(vacancy) {
  if (!vacancy) return '';
  const lines = ['Post | Vacancy'];
  if (Array.isArray(vacancy.details) && vacancy.details.length) {
    for (let i = 0; i < vacancy.details.length; i += 1) {
      const row = vacancy.details[i];
      if (row && typeof row === 'object') {
        lines.push(`${pickString(row.post) || pickString(row.postName)} | ${pickString(row.count) || pickString(row.vacancy) || ''}`);
      }
    }
  } else if (vacancy.postName || vacancy.totalPosts) {
    lines.push(`${pickString(vacancy.postName) || 'Post'} | ${vacancy.totalPosts || ''}`);
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

function buildShortInformation(recruitment) {
  const parts = [];
  if (recruitment.recruitmentName) parts.push(recruitment.recruitmentName);
  if (recruitment.advertisementNumber) parts.push(`Advertisement No: ${recruitment.advertisementNumber}`);
  if (recruitment.organization) parts.push(`Organization: ${recruitment.organization}`);
  if (recruitment.department) parts.push(`Department: ${recruitment.department}`);
  if (recruitment.currentStage) parts.push(`Current Stage: ${recruitment.currentStage}`);
  if (recruitment.currentStatus) parts.push(`Status: ${recruitment.currentStatus}`);
  return parts.join('\n');
}

function mapToRendererSections(recruitment = {}) {
  const sections = {};

  const shortInfo = buildShortInformation(recruitment);
  if (shortInfo) sections[CANONICAL_SECTIONS.SHORT_INFORMATION] = shortInfo;

  const dates = formatImportantDates(recruitment.importantDates);
  if (dates) sections[CANONICAL_SECTIONS.IMPORTANT_DATES] = dates;

  if (pickString(recruitment.eligibility)) {
    sections[CANONICAL_SECTIONS.ELIGIBILITY] = recruitment.eligibility;
  }
  if (pickString(recruitment.fees)) {
    sections[CANONICAL_SECTIONS.APPLICATION_FEE] = recruitment.fees;
  }
  if (pickString(recruitment.selectionProcess)) {
    sections[CANONICAL_SECTIONS.SELECTION_PROCESS] = recruitment.selectionProcess;
  }

  const vacancyTable = formatVacancyTable(recruitment.vacancy);
  if (vacancyTable) sections[CANONICAL_SECTIONS.VACANCY_TABLE] = vacancyTable;

  const links = formatImportantLinks(recruitment.importantLinks);
  if (links) sections[CANONICAL_SECTIONS.IMPORTANT_LINKS] = links;

  return deepFreeze(sections);
}

function buildGeneratorDataField(recruitment = {}) {
  const sections = mapToRendererSections(recruitment);
  const parts = [];
  const sectionKeys = Object.keys(sections);
  for (let i = 0; i < sectionKeys.length; i += 1) {
    const title = sectionKeys[i];
    parts.push(`[Section: ${title}]`);
    parts.push(sections[title]);
    parts.push('');
  }
  return parts.join('\n').trim();
}

function buildGeneratorPayload(recruitment = {}) {
  const lastDateEntry = (recruitment.importantDates || []).find((d) =>
    /last\s*date|closing/i.test(pickString(d.label))
  );

  return deepFreeze({
    title: pickString(recruitment.recruitmentName) || 'Untitled Recruitment',
    post_name: recruitment.vacancy ? pickString(recruitment.vacancy.postName) : '',
    total_posts: recruitment.vacancy ? recruitment.vacancy.totalPosts : null,
    advertisement_no: pickString(recruitment.advertisementNumber),
    status: recruitment.currentStatus || 'active',
    structuredDepartment: pickString(recruitment.department),
    pageUrl: pickString(recruitment.officialNotification) || pickString(recruitment.officialWebsite),
    data: buildGeneratorDataField(recruitment),
    lastDate: lastDateEntry ? pickString(lastDateEntry.date) : null,
    rendererCompatible: true,
    htmlGenerated: false,
  });
}

module.exports = {
  RENDERER_COMPATIBILITY_VERSION,
  CANONICAL_SECTIONS,
  mapToRendererSections,
  buildGeneratorDataField,
  buildGeneratorPayload,
};
