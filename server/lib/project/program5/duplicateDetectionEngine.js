'use strict';

/**
 * PROGRAM 5 — Package 5E
 * Duplicate Detection Engine (Reusable / Diagnostics Only)
 *
 * Detects:
 *   - Exact duplicates
 *   - Near duplicates
 *   - Same advertisement
 *   - Same organization
 *   - Same recruitment with updated metadata
 *
 * Generates diagnostics only. Never merges or deletes.
 */

const { deepFreeze, createCandidateIdentityModel } = require('./candidateIdentityContract');
const {
  FINGERPRINT_CLASSES,
  generateIdentityFingerprint,
  compareIdentityFingerprints,
} = require('./identityFingerprintEngine');

const DUPLICATE_DETECTION_VERSION = '5E.1.0.0';

const DUPLICATE_RELATION_TYPES = Object.freeze({
  EXACT_DUPLICATE: 'exact_duplicate',
  NEAR_DUPLICATE: 'near_duplicate',
  SAME_ADVERTISEMENT: 'same_advertisement',
  SAME_ORGANIZATION: 'same_organization',
  SAME_RECRUITMENT_UPDATED_METADATA: 'same_recruitment_updated_metadata',
  UNRELATED: 'unrelated',
});

const DIAGNOSTIC_SEVERITY = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
});

const COMPARISON_FIELDS = Object.freeze([
  'source',
  'sourceUrl',
  'recruitmentType',
  'organization',
  'department',
  'qualification',
  'state',
  'advertisementNumber',
  'title',
]);

function normalizeIdentity(input, fingerprintOptions) {
  if (input && input.contractVersion && input.identityFingerprint != null) {
    return input;
  }
  const fingerprint = generateIdentityFingerprint(input, fingerprintOptions);
  return createCandidateIdentityModel({
    ...input,
    fingerprintResult: fingerprint,
  });
}

function fieldMap(identity) {
  return {
    source: identity.source,
    sourceUrl: identity.sourceUrl,
    recruitmentType: identity.recruitmentType,
    organization: identity.organization,
    department: identity.department,
    qualification: identity.qualification,
    state: identity.state,
    advertisementNumber: identity.advertisementNumber,
    title: identity.title,
  };
}

function compareFields(left, right) {
  const matchingFields = [];
  const differentFields = [];
  const missingFields = [];

  for (const fieldId of COMPARISON_FIELDS) {
    const a = left[fieldId];
    const b = right[fieldId];
    if (a == null && b == null) {
      missingFields.push(fieldId);
      continue;
    }
    if (a == null || b == null) {
      differentFields.push(fieldId);
      continue;
    }
    if (String(a).toLowerCase() === String(b).toLowerCase()) {
      matchingFields.push(fieldId);
    } else {
      differentFields.push(fieldId);
    }
  }

  return { matchingFields, differentFields, missingFields };
}

function datesSignature(identity) {
  const dates = Array.isArray(identity.importantDates)
    ? identity.importantDates
    : [];
  return dates
    .map((entry) => `${entry.label || ''}:${entry.date || ''}`)
    .sort()
    .join('|');
}

function classifyPair(left, right, fingerprintComparison, fieldComparison) {
  const diagnostics = [];
  const relations = [];

  if (
    fingerprintComparison.matched &&
    fingerprintComparison.matchClass === FINGERPRINT_CLASSES.EXACT_IDENTITY
  ) {
    relations.push(DUPLICATE_RELATION_TYPES.EXACT_DUPLICATE);
    diagnostics.push({
      code: 'EXACT_DUPLICATE_FINGERPRINT',
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      message: 'Exact identity fingerprints match.',
    });
  }

  if (
    left.sourceUrl &&
    right.sourceUrl &&
    String(left.sourceUrl).toLowerCase() === String(right.sourceUrl).toLowerCase()
  ) {
    if (!relations.includes(DUPLICATE_RELATION_TYPES.EXACT_DUPLICATE)) {
      relations.push(DUPLICATE_RELATION_TYPES.EXACT_DUPLICATE);
    }
    diagnostics.push({
      code: 'EXACT_DUPLICATE_SOURCE_URL',
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      message: 'Source URLs match exactly.',
    });
  }

  if (
    left.advertisementNumber &&
    right.advertisementNumber &&
    String(left.advertisementNumber).toLowerCase() ===
      String(right.advertisementNumber).toLowerCase()
  ) {
    relations.push(DUPLICATE_RELATION_TYPES.SAME_ADVERTISEMENT);
    diagnostics.push({
      code: 'SAME_ADVERTISEMENT_NUMBER',
      severity: DIAGNOSTIC_SEVERITY.INFO,
      message: 'Advertisement numbers match.',
    });
  }

  if (
    left.organization &&
    right.organization &&
    String(left.organization).toLowerCase() ===
      String(right.organization).toLowerCase()
  ) {
    relations.push(DUPLICATE_RELATION_TYPES.SAME_ORGANIZATION);
    diagnostics.push({
      code: 'SAME_ORGANIZATION',
      severity: DIAGNOSTIC_SEVERITY.INFO,
      message: 'Organizations match.',
    });
  }

  const sameCoreRecruitment =
    relations.includes(DUPLICATE_RELATION_TYPES.SAME_ADVERTISEMENT) ||
    (relations.includes(DUPLICATE_RELATION_TYPES.SAME_ORGANIZATION) &&
      fieldComparison.matchingFields.includes('title') &&
      fieldComparison.matchingFields.includes('recruitmentType'));

  const metadataChanged =
    fieldComparison.differentFields.length > 0 ||
    datesSignature(left) !== datesSignature(right);

  if (sameCoreRecruitment && metadataChanged) {
    relations.push(DUPLICATE_RELATION_TYPES.SAME_RECRUITMENT_UPDATED_METADATA);
    diagnostics.push({
      code: 'SAME_RECRUITMENT_UPDATED_METADATA',
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      message:
        'Candidates appear to represent the same recruitment with updated metadata.',
      differentFields: fieldComparison.differentFields.slice(),
    });
  }

  if (
    fingerprintComparison.matched &&
    fingerprintComparison.matchClass === FINGERPRINT_CLASSES.STRONG_SIMILARITY
  ) {
    relations.push(DUPLICATE_RELATION_TYPES.NEAR_DUPLICATE);
    diagnostics.push({
      code: 'NEAR_DUPLICATE_STRONG_FINGERPRINT',
      severity: DIAGNOSTIC_SEVERITY.WARNING,
      message: 'Strong similarity fingerprints match.',
    });
  } else if (
    fingerprintComparison.matched &&
    fingerprintComparison.matchClass === FINGERPRINT_CLASSES.PARTIAL_SIMILARITY
  ) {
    relations.push(DUPLICATE_RELATION_TYPES.NEAR_DUPLICATE);
    diagnostics.push({
      code: 'NEAR_DUPLICATE_PARTIAL_FINGERPRINT',
      severity: DIAGNOSTIC_SEVERITY.INFO,
      message: 'Partial similarity fingerprints match.',
    });
  } else if (
    !relations.length &&
    fieldComparison.matchingFields.length >= 3 &&
    fieldComparison.matchingFields.includes('organization')
  ) {
    relations.push(DUPLICATE_RELATION_TYPES.NEAR_DUPLICATE);
    diagnostics.push({
      code: 'NEAR_DUPLICATE_FIELD_OVERLAP',
      severity: DIAGNOSTIC_SEVERITY.INFO,
      message: 'Multiple identity fields overlap without exact fingerprint match.',
      matchingFields: fieldComparison.matchingFields.slice(),
    });
  }

  const uniqueRelations = Array.from(new Set(relations));
  if (!uniqueRelations.length) {
    uniqueRelations.push(DUPLICATE_RELATION_TYPES.UNRELATED);
  }

  const identityScore = Math.min(
    1,
    Number(
      (
        fingerprintComparison.score * 0.7 +
        fieldComparison.matchingFields.length / COMPARISON_FIELDS.length * 0.3
      ).toFixed(4)
    )
  );

  return {
    relations: uniqueRelations,
    diagnostics,
    identityScore,
  };
}

/**
 * Detect advisory duplicate relationships for a candidate set.
 *
 * @param {object} [input]
 * @param {object[]} [input.candidates]
 * @param {object} [input.fingerprintOptions]
 */
function detectCandidateDuplicates(input = {}) {
  const candidatesIn = Array.isArray(input.candidates) ? input.candidates : [];
  const fingerprintOptions = input.fingerprintOptions || {};

  const identities = candidatesIn.map((candidate) =>
    normalizeIdentity(candidate, fingerprintOptions)
  );

  const pairs = [];
  const diagnostics = [];

  for (let i = 0; i < identities.length; i += 1) {
    for (let j = i + 1; j < identities.length; j += 1) {
      const left = identities[i];
      const right = identities[j];
      const leftFp = generateIdentityFingerprint(left, fingerprintOptions);
      const rightFp = generateIdentityFingerprint(right, fingerprintOptions);
      const fingerprintComparison = compareIdentityFingerprints(leftFp, rightFp);
      const fieldComparison = compareFields(fieldMap(left), fieldMap(right));
      const classified = classifyPair(
        left,
        right,
        fingerprintComparison,
        fieldComparison
      );

      const pair = deepFreeze({
        leftCandidateId: left.candidateId,
        rightCandidateId: right.candidateId,
        relations: classified.relations,
        primaryRelation: classified.relations[0],
        identityScore: classified.identityScore,
        matchingFields: fieldComparison.matchingFields,
        differentFields: fieldComparison.differentFields,
        missingFields: fieldComparison.missingFields,
        fingerprintComparison,
        advisoryOnly: true,
        autoMerged: false,
      });

      pairs.push(pair);
      for (const diag of classified.diagnostics) {
        diagnostics.push({
          ...diag,
          leftCandidateId: left.candidateId,
          rightCandidateId: right.candidateId,
        });
      }
    }
  }

  const relatedPairs = pairs.filter(
    (pair) => pair.primaryRelation !== DUPLICATE_RELATION_TYPES.UNRELATED
  );

  return deepFreeze({
    detectionVersion: DUPLICATE_DETECTION_VERSION,
    advisoryOnly: true,
    diagnosticsOnly: true,
    aiUsed: false,
    automaticMerge: false,
    candidateCount: identities.length,
    pairCount: pairs.length,
    relatedPairCount: relatedPairs.length,
    identities,
    pairs,
    relatedPairs,
    diagnostics,
    summary: {
      exactDuplicates: relatedPairs.filter((p) =>
        p.relations.includes(DUPLICATE_RELATION_TYPES.EXACT_DUPLICATE)
      ).length,
      nearDuplicates: relatedPairs.filter((p) =>
        p.relations.includes(DUPLICATE_RELATION_TYPES.NEAR_DUPLICATE)
      ).length,
      sameAdvertisement: relatedPairs.filter((p) =>
        p.relations.includes(DUPLICATE_RELATION_TYPES.SAME_ADVERTISEMENT)
      ).length,
      sameOrganization: relatedPairs.filter((p) =>
        p.relations.includes(DUPLICATE_RELATION_TYPES.SAME_ORGANIZATION)
      ).length,
      updatedMetadata: relatedPairs.filter((p) =>
        p.relations.includes(
          DUPLICATE_RELATION_TYPES.SAME_RECRUITMENT_UPDATED_METADATA
        )
      ).length,
    },
  });
}

module.exports = {
  DUPLICATE_DETECTION_VERSION,
  DUPLICATE_RELATION_TYPES,
  DIAGNOSTIC_SEVERITY,
  COMPARISON_FIELDS,
  detectCandidateDuplicates,
  compareFields,
};
