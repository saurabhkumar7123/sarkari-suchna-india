"use strict";

/**
 * Phase AI-4 — Cross-section consistency validation.
 * Advisory findings only — never rewrites the draft.
 */

const { SECTION_TYPES, SECTION_TYPE_TO_TITLE, VALIDATION_CODES, SEVERITY, LINK_CATEGORIES } = require("./types");
const { getSection } = require("./draftModel");
const {
  extractDates,
  sameIdentifier,
  toKey,
  collapse,
  uniqueBy
} = require("./draftUtils");

/**
 * @param {string} code
 * @param {string} severity
 * @param {string} message
 * @param {object} [extra]
 * @returns {object}
 */
function issue(code, severity, message, extra = {}) {
  return {
    code,
    severity,
    message,
    advisoryOnly: true,
    ...extra
  };
}

/**
 * Dates mentioned outside Important Dates should also appear there.
 * @param {object} draft
 * @returns {object[]}
 */
function validateDatesAcrossSections(draft) {
  const issues = [];
  const datesSec = getSection(draft, SECTION_TYPES.IMPORTANT_DATES);
  const dateSet = new Set((datesSec ? datesSec.dates : []).map((d) => toKey(d)));

  const short = getSection(draft, SECTION_TYPES.SHORT_INFORMATION);
  if (short && short.dates.length) {
    for (const date of short.dates) {
      if (!dateSet.has(toKey(date))) {
        issues.push(
          issue(
            VALIDATION_CODES.DATE_MISSING_FROM_IMPORTANT_DATES,
            SEVERITY.HIGH,
            `Date "${date}" appears in Short Information but not in Important Dates.`,
            { sectionType: SECTION_TYPES.IMPORTANT_DATES, value: date }
          )
        );
      }
    }
  }

  if (datesSec) {
    // Use raw lines — extracted date lists are already de-duplicated.
    const rawDates = [];
    for (const line of datesSec.lines || []) {
      rawDates.push(...extractDates(line));
    }
    const seen = new Set();
    for (const date of rawDates) {
      const key = toKey(date);
      if (seen.has(key)) {
        issues.push(
          issue(
            VALIDATION_CODES.DUPLICATE_DATE_ENTRIES,
            SEVERITY.MEDIUM,
            `Duplicate date entry "${date}" in Important Dates.`,
            { sectionType: SECTION_TYPES.IMPORTANT_DATES, value: date }
          )
        );
      }
      seen.add(key);
    }
  }

  return issues;
}

/**
 * Application fee figures should agree wherever mentioned.
 * @param {object} draft
 * @returns {object[]}
 */
function validateFees(draft) {
  const issues = [];
  const feeSec = getSection(draft, SECTION_TYPES.APPLICATION_FEE);
  if (!feeSec || !feeSec.fees.length) return issues;

  const canonical = new Set(feeSec.fees);
  const otherSections = [SECTION_TYPES.SHORT_INFORMATION, SECTION_TYPES.HOW_TO_APPLY, SECTION_TYPES.IMPORTANT_INSTRUCTIONS];

  for (const sectionType of otherSections) {
    const sec = getSection(draft, sectionType);
    if (!sec || !sec.fees.length) continue;
    for (const amount of sec.fees) {
      if (!canonical.has(amount)) {
        issues.push(
          issue(
            VALIDATION_CODES.FEE_VALUE_MISMATCH,
            SEVERITY.HIGH,
            `Fee amount Rs ${amount} in ${SECTION_TYPE_TO_TITLE[sectionType]} does not appear in Application Fee.`,
            { sectionType, value: amount, expected: [...canonical] }
          )
        );
      }
    }
  }

  return issues;
}

/**
 * Vacancy row sums should match an explicit total when present.
 * @param {object} draft
 * @returns {object[]}
 */
function validateVacancyTotals(draft) {
  const issues = [];
  const vac = getSection(draft, SECTION_TYPES.VACANCY_DETAILS);
  if (!vac || !vac.vacancy) return issues;

  const { rowTotals, statedTotal, sum } = vac.vacancy;
  if (statedTotal != null && rowTotals.length >= 2 && statedTotal !== sum) {
    issues.push(
      issue(
        VALIDATION_CODES.VACANCY_TOTAL_MISMATCH,
        SEVERITY.CRITICAL,
        `Vacancy table rows sum to ${sum} but stated total is ${statedTotal}.`,
        {
          sectionType: SECTION_TYPES.VACANCY_DETAILS,
          rowSum: sum,
          statedTotal,
          rowTotals
        }
      )
    );
  }

  const short = getSection(draft, SECTION_TYPES.SHORT_INFORMATION);
  if (short && short.vacancy && short.vacancy.statedTotal != null && vac.vacancy) {
    const shortTotal = short.vacancy.statedTotal;
    const vacTotal = vac.vacancy.statedTotal != null ? vac.vacancy.statedTotal : vac.vacancy.sum;
    if (vacTotal && shortTotal && shortTotal !== vacTotal) {
      issues.push(
        issue(
          VALIDATION_CODES.VACANCY_TOTAL_MISMATCH,
          SEVERITY.HIGH,
          `Short Information total (${shortTotal}) disagrees with Vacancy Details (${vacTotal}).`,
          { shortTotal, vacancyTotal: vacTotal }
        )
      );
    }
  }

  return issues;
}

/**
 * Eligibility prose should not contradict qualification table text.
 * @param {object} draft
 * @returns {object[]}
 */
function validateEligibility(draft) {
  const issues = [];
  const eligibility = getSection(draft, SECTION_TYPES.ELIGIBILITY);
  const qualification = getSection(draft, SECTION_TYPES.QUALIFICATION);
  if (!eligibility || !qualification) return issues;

  const elig = toKey(eligibility.content);
  const qual = toKey(qualification.content);

  const degreePatterns = [
    ["graduate", /graduate|graduation|bachelor|degree/],
    ["12th", /12th|intermediate|senior secondary|10\+2/],
    ["10th", /10th|matric|high school/],
    ["postgraduate", /post\s*graduate|master|pg\b/],
    ["diploma", /diploma/]
  ];

  const eligDegrees = degreePatterns.filter(([, re]) => re.test(elig)).map(([name]) => name);
  const qualDegrees = degreePatterns.filter(([, re]) => re.test(qual)).map(([name]) => name);

  if (eligDegrees.length && qualDegrees.length) {
    const overlap = eligDegrees.filter((d) => qualDegrees.includes(d));
    if (!overlap.length) {
      issues.push(
        issue(
          VALIDATION_CODES.ELIGIBILITY_QUALIFICATION_CONFLICT,
          SEVERITY.HIGH,
          `Eligibility mentions ${eligDegrees.join(", ")} while Qualification mentions ${qualDegrees.join(", ")}.`,
          { eligibilityDegrees: eligDegrees, qualificationDegrees: qualDegrees }
        )
      );
    }
  }

  return issues;
}

/**
 * Important Links categories should suit the draft profile / event type.
 * @param {object} draft
 * @returns {object[]}
 */
function validateLinksForEventType(draft) {
  const issues = [];
  const categories = new Set((draft.links || []).map((l) => l.category));
  const expected = draft.expectedLinks || [];

  for (const needed of expected) {
    if (!categories.has(needed)) {
      // Missing expected link is primarily a missing-info finding; here we only
      // flag contradictory categories that are actively wrong for the profile.
      continue;
    }
  }

  const profile = draft.profile;
  if (profile === "admit_card" && categories.has(LINK_CATEGORIES.RESULT) && !categories.has(LINK_CATEGORIES.ADMIT_CARD)) {
    issues.push(
      issue(
        VALIDATION_CODES.LINK_EVENT_TYPE_MISMATCH,
        SEVERITY.MEDIUM,
        "Admit Card draft exposes a Result link but no Admit Card link.",
        { profile, categories: [...categories] }
      )
    );
  }
  if (profile === "result" && categories.has(LINK_CATEGORIES.ADMIT_CARD) && !categories.has(LINK_CATEGORIES.RESULT)) {
    issues.push(
      issue(
        VALIDATION_CODES.LINK_EVENT_TYPE_MISMATCH,
        SEVERITY.MEDIUM,
        "Result draft exposes an Admit Card link but no Result link.",
        { profile, categories: [...categories] }
      )
    );
  }
  if (profile === "new_recruitment" && categories.has(LINK_CATEGORIES.RESULT) && !categories.has(LINK_CATEGORIES.APPLY_ONLINE)) {
    issues.push(
      issue(
        VALIDATION_CODES.LINK_EVENT_TYPE_MISMATCH,
        SEVERITY.LOW,
        "New recruitment draft includes a Result link without Apply Online.",
        { profile }
      )
    );
  }

  return issues;
}

/**
 * Reference / advertisement numbers must stay consistent across sections.
 * @param {object} draft
 * @returns {object[]}
 */
function validateIdentifiers(draft) {
  const issues = [];
  const advs = uniqueBy(draft.advertisementNumbers || [], (v) => toKey(v).replace(/[\s.\-_/]/g, ""));
  const refs = uniqueBy(draft.referenceNumbers || [], (v) => toKey(v).replace(/[\s.\-_/]/g, ""));

  if (advs.length > 1) {
    const conflict = advs.some((a, i) => advs.slice(i + 1).some((b) => !sameIdentifier(a, b)));
    if (conflict || advs.length > 1) {
      const normalized = advs.map((v) => toKey(v).replace(/[\s.\-_/]/g, ""));
      const uniqueNorm = [...new Set(normalized)];
      if (uniqueNorm.length > 1) {
        issues.push(
          issue(
            VALIDATION_CODES.ADVERTISEMENT_NUMBER_INCONSISTENT,
            SEVERITY.CRITICAL,
            `Advertisement numbers disagree across sections: ${advs.join(" vs ")}.`,
            { values: advs }
          )
        );
      }
    }
  }

  if (refs.length > 1) {
    const normalized = refs.map((v) => toKey(v).replace(/[\s.\-_/]/g, ""));
    const uniqueNorm = [...new Set(normalized)];
    if (uniqueNorm.length > 1) {
      issues.push(
        issue(
          VALIDATION_CODES.REFERENCE_NUMBER_INCONSISTENT,
          SEVERITY.CRITICAL,
          `Reference numbers disagree across sections: ${refs.join(" vs ")}.`,
          { values: refs }
        )
      );
    }
  }

  return issues;
}

/**
 * Empty known sections and inconsistent exam/application terminology.
 * @param {object} draft
 * @returns {object[]}
 */
function validateSectionHygiene(draft) {
  const issues = [];
  for (const sec of draft.sections || []) {
    if (sec.isKnown && sec.isEmpty) {
      issues.push(
        issue(
          VALIDATION_CODES.EMPTY_SECTION,
          SEVERITY.MEDIUM,
          `Section "${sec.generatorTitle}" is present but empty.`,
          { sectionType: sec.sectionType }
        )
      );
    }
  }

  const blob = toKey(draft.fullText || "");
  const usesApplyOnline = /\bapply online\b|\bonline apply\b/.test(blob);
  const usesRegistration = /\bonline registration\b|\bregistration form\b/.test(blob);
  if (usesApplyOnline && usesRegistration) {
    const how = getSection(draft, SECTION_TYPES.HOW_TO_APPLY);
    if (how && /apply online/i.test(how.content) && /registration/i.test(how.content)) {
      issues.push(
        issue(
          VALIDATION_CODES.TERMINOLOGY_INCONSISTENT,
          SEVERITY.LOW,
          'How To Apply mixes "Apply Online" and "Registration" wording — prefer one term.',
          { sectionType: SECTION_TYPES.HOW_TO_APPLY }
        )
      );
    }
  }

  return issues;
}

/**
 * Run all cross-section validators.
 * @param {object} draft
 * @returns {{ issues: object[], counts: object, explanation: string }}
 */
function validateCrossSections(draft) {
  const issues = [
    ...validateDatesAcrossSections(draft),
    ...validateFees(draft),
    ...validateVacancyTotals(draft),
    ...validateEligibility(draft),
    ...validateLinksForEventType(draft),
    ...validateIdentifiers(draft),
    ...validateSectionHygiene(draft)
  ];

  const counts = {
    critical: issues.filter((i) => i.severity === SEVERITY.CRITICAL).length,
    high: issues.filter((i) => i.severity === SEVERITY.HIGH).length,
    medium: issues.filter((i) => i.severity === SEVERITY.MEDIUM).length,
    low: issues.filter((i) => i.severity === SEVERITY.LOW).length,
    total: issues.length
  };

  return {
    issues,
    counts,
    explanation:
      counts.total === 0
        ? "No cross-section consistency issues detected."
        : `Found ${counts.total} consistency issue(s): ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low.`
  };
}

module.exports = {
  validateCrossSections,
  validateDatesAcrossSections,
  validateFees,
  validateVacancyTotals,
  validateEligibility,
  validateLinksForEventType,
  validateIdentifiers,
  validateSectionHygiene
};
