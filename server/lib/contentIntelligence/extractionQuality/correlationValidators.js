"use strict";

/**
 * CIP Stage 3E — correlation / cross-document / generator compatibility validators.
 * Consumes Stage 3D correlation objects read-only.
 */

const {
  SEVERITIES,
  VALIDATION_CATEGORIES,
  QUALITY_DIMENSIONS,
  createFinding
} = require("./extractionQualityTypes");
const { CORE_RECRUITMENT_SECTIONS } = require("./extractionQualityRules");
const { asArray, hasText } = require("./extractionQualityUtils");
const { ROLE_TIMELINE_PRECEDENCE } = require("../multiSourceCorrelation/correlationTypes");
const { matchSectionTitle, buildHeadingKey } = require("../structureIntelligence/sectionRules");
const { SECTION_TYPE_LIST, UNKNOWN_SECTION_TYPE } = require("../structureIntelligence/structureTypes");

function validateCorrelation(correlation, documents) {
  const findings = [];
  if (!correlation) {
    if (documents.length > 1) {
      findings.push(
        createFinding({
          rule: "CORR_MISSING_FOR_MULTI",
          severity: SEVERITIES.INFO,
          category: VALIDATION_CATEGORIES.CORRELATION,
          dimension: QUALITY_DIMENSIONS.CORRELATION_QUALITY,
          message:
            "Multiple documents assessed without a Stage 3D correlation object; cross-document correlation checks are limited.",
          documentId: null
        })
      );
    }
    return findings;
  }

  const confidence = correlation.correlationConfidence || "none";
  if (confidence === "none" || confidence === "low") {
    findings.push(
      createFinding({
        rule: "CORR_WEAK_CONFIDENCE",
        severity: confidence === "none" ? SEVERITIES.ERROR : SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.CORRELATION,
        dimension: QUALITY_DIMENSIONS.CORRELATION_QUALITY,
        message: `Correlation confidence is ${confidence}.`,
        documentId: null,
        details: { correlationConfidence: confidence }
      })
    );
  }

  const identity = correlation.recruitmentIdentity || {};
  if (!hasText(identity.recruitmentKey) && !hasText(identity.advertisementNumber)) {
    findings.push(
      createFinding({
        rule: "CORR_IDENTITY_WEAK",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.CORRELATION,
        dimension: QUALITY_DIMENSIONS.CORRELATION_QUALITY,
        message: "Recruitment identity lacks advertisement number and recruitment key.",
        documentId: null
      })
    );
  }

  if (!identity.hasNotification) {
    findings.push(
      createFinding({
        rule: "CORR_NO_NOTIFICATION",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.CORRELATION,
        dimension: QUALITY_DIMENSIONS.CORRELATION_QUALITY,
        message: "Correlated set has no primary notification document.",
        documentId: null
      })
    );
  }

  for (const warning of asArray(correlation.warnings)) {
    findings.push(
      createFinding({
        rule: "CORR_WARNING",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.CORRELATION,
        dimension: QUALITY_DIMENSIONS.WARNINGS,
        message: String(warning),
        documentId: null
      })
    );
  }

  const unrelated = asArray(correlation.unrelatedDocumentIds);
  if (unrelated.length) {
    findings.push(
      createFinding({
        rule: "CORR_UNRELATED_DOCUMENTS",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.CORRELATION,
        dimension: QUALITY_DIMENSIONS.CROSS_DOCUMENT_CONSISTENCY,
        message: `${unrelated.length} unrelated document(s) in correlation set.`,
        documentId: null,
        details: { unrelatedDocumentIds: unrelated.slice() }
      })
    );
  }

  return findings;
}

function validateRelationships(correlation) {
  const findings = [];
  if (!correlation) return findings;

  const edges = asArray(correlation.relationships);
  const docs = asArray(correlation.documents);
  const ids = new Set(docs.map((doc) => doc.documentId));

  for (const edge of edges) {
    if (!ids.has(edge.fromDocumentId) || !ids.has(edge.toDocumentId)) {
      findings.push(
        createFinding({
          rule: "REL_DANGLING_EDGE",
          severity: SEVERITIES.ERROR,
          category: VALIDATION_CATEGORIES.RELATIONSHIP,
          dimension: QUALITY_DIMENSIONS.CORRELATION_QUALITY,
          message: "Relationship edge references a missing document.",
          documentId: edge.fromDocumentId || null,
          details: {
            fromDocumentId: edge.fromDocumentId,
            toDocumentId: edge.toDocumentId
          }
        })
      );
    }
  }

  const graph = correlation.relationshipGraph;
  if (graph) {
    if (!graph.rootId || !graph.root) {
      findings.push(
        createFinding({
          rule: "REL_GRAPH_ROOT_MISSING",
          severity: SEVERITIES.ERROR,
          category: VALIDATION_CATEGORIES.RELATIONSHIP,
          dimension: QUALITY_DIMENSIONS.CORRELATION_QUALITY,
          message: "Relationship graph is missing its recruitment root.",
          documentId: null
        })
      );
    }
    for (const edge of asArray(graph.edges)) {
      if (!edge.from || !edge.to) {
        findings.push(
          createFinding({
            rule: "REL_GRAPH_EDGE_INCOMPLETE",
            severity: SEVERITIES.WARNING,
            category: VALIDATION_CATEGORIES.RELATIONSHIP,
            dimension: QUALITY_DIMENSIONS.CORRELATION_QUALITY,
            message: "Relationship graph edge is incomplete.",
            documentId: null,
            details: edge
          })
        );
      }
    }
  }

  return findings;
}

function parseIsoDate(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return null;
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? null : ms;
}

function validateTimeline(correlation) {
  const findings = [];
  if (!correlation) return findings;

  const timeline = asArray(correlation.timeline);
  for (let i = 1; i < timeline.length; i += 1) {
    const prev = timeline[i - 1];
    const curr = timeline[i];
    const prevMs = parseIsoDate(prev.date);
    const currMs = parseIsoDate(curr.date);
    if (prevMs != null && currMs != null && currMs < prevMs) {
      findings.push(
        createFinding({
          rule: "TIME_OUT_OF_ORDER",
          severity: SEVERITIES.ERROR,
          category: VALIDATION_CATEGORIES.TIMELINE,
          dimension: QUALITY_DIMENSIONS.CROSS_DOCUMENT_CONSISTENCY,
          message: "Timeline dates are not chronologically consistent.",
          documentId: curr.documentId || null,
          details: {
            previousDocumentId: prev.documentId,
            previousDate: prev.date,
            currentDocumentId: curr.documentId,
            currentDate: curr.date
          }
        })
      );
    }

    // Role precedence vs dated order conflict (dated earlier role after later role)
    if (prevMs != null && currMs != null && currMs === prevMs) {
      const prevRank = ROLE_TIMELINE_PRECEDENCE[prev.role] ?? 999;
      const currRank = ROLE_TIMELINE_PRECEDENCE[curr.role] ?? 999;
      if (currRank < prevRank) {
        findings.push(
          createFinding({
            rule: "TIME_ROLE_PRECEDENCE_CONFLICT",
            severity: SEVERITIES.INFO,
            category: VALIDATION_CATEGORIES.TIMELINE,
            dimension: QUALITY_DIMENSIONS.CROSS_DOCUMENT_CONSISTENCY,
            message: "Same-date timeline entries conflict with lifecycle role precedence.",
            documentId: curr.documentId || null,
            details: { previousRole: prev.role, currentRole: curr.role }
          })
        );
      }
    }
  }

  // Lifecycle inversion when both dated: later-role document dated before earlier-role
  for (let i = 0; i < timeline.length; i += 1) {
    for (let j = i + 1; j < timeline.length; j += 1) {
      const earlier = timeline[i];
      const later = timeline[j];
      const earlierMs = parseIsoDate(earlier.date);
      const laterMs = parseIsoDate(later.date);
      if (earlierMs == null || laterMs == null) continue;
      const earlierRank = ROLE_TIMELINE_PRECEDENCE[earlier.role] ?? 999;
      const laterRank = ROLE_TIMELINE_PRECEDENCE[later.role] ?? 999;
      if (laterRank < earlierRank && laterMs < earlierMs) {
        findings.push(
          createFinding({
            rule: "TIME_LIFECYCLE_INVERSION",
            severity: SEVERITIES.WARNING,
            category: VALIDATION_CATEGORIES.TIMELINE,
            dimension: QUALITY_DIMENSIONS.CROSS_DOCUMENT_CONSISTENCY,
            message: "Timeline lifecycle order conflicts with document dates.",
            documentId: later.documentId || null,
            details: {
              earlierRole: earlier.role,
              earlierDate: earlier.date,
              laterRole: later.role,
              laterDate: later.date
            }
          })
        );
      }
    }
  }

  return findings;
}

function validateCrossDocumentConsistency(documents, correlation) {
  const findings = [];
  if (documents.length < 2) return findings;

  const orgs = new Set();
  const advts = new Set();
  for (const view of documents) {
    const meta = view.metadata || {};
    if (hasText(meta.organization)) orgs.add(String(meta.organization).trim().toLowerCase());
    if (hasText(meta.advertisementNumber)) {
      advts.add(String(meta.advertisementNumber).trim().toLowerCase());
    }
    // Stage 1B normalized metadata may live under nested shapes on correlation views
    if (meta && meta.normalizedMetadata) {
      if (hasText(meta.normalizedMetadata.organization)) {
        orgs.add(String(meta.normalizedMetadata.organization).trim().toLowerCase());
      }
      if (hasText(meta.normalizedMetadata.advertisementNumber)) {
        advts.add(String(meta.normalizedMetadata.advertisementNumber).trim().toLowerCase());
      }
    }
  }

  if (orgs.size > 1) {
    findings.push(
      createFinding({
        rule: "XDOC_ORG_MISMATCH",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.CONSISTENCY,
        dimension: QUALITY_DIMENSIONS.CROSS_DOCUMENT_CONSISTENCY,
        message: "Organization metadata differs across documents.",
        documentId: null,
        details: { organizations: Array.from(orgs).sort() }
      })
    );
  }

  if (advts.size > 1) {
    findings.push(
      createFinding({
        rule: "XDOC_ADVT_MISMATCH",
        severity: SEVERITIES.WARNING,
        category: VALIDATION_CATEGORIES.CONSISTENCY,
        dimension: QUALITY_DIMENSIONS.CROSS_DOCUMENT_CONSISTENCY,
        message: "Advertisement numbers differ across documents.",
        documentId: null,
        details: { advertisementNumbers: Array.from(advts).sort() }
      })
    );
  }

  if (correlation) {
    const marks = (correlation.duplicateAnalysis && correlation.duplicateAnalysis.marks) || {};
    for (const [documentId, mark] of Object.entries(marks)) {
      if (mark && (mark.exactDuplicate || mark.duplicateType === "exact_duplicate")) {
        findings.push(
          createFinding({
            rule: "XDOC_EXACT_DUPLICATE",
            severity: SEVERITIES.INFO,
            category: VALIDATION_CATEGORIES.CONSISTENCY,
            dimension: QUALITY_DIMENSIONS.CROSS_DOCUMENT_CONSISTENCY,
            message: "Exact duplicate document marked by correlation (not removed).",
            documentId,
            details: mark
          })
        );
      }
    }
  }

  return findings;
}

/**
 * Generator compatibility is advisory for extraction outputs:
 * known section titles / types that Stage 1C+1D and Generator understand.
 * Does not invoke Generator or modify drafts.
 */
function validateGeneratorCompatibility(documents) {
  const findings = [];

  for (const view of documents) {
    const sections = asArray(view.sections);
    if (!sections.length) {
      findings.push(
        createFinding({
          rule: "GEN_NO_SECTIONS",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.GENERATOR,
          dimension: QUALITY_DIMENSIONS.GENERATOR_COMPATIBILITY,
          message: "No sections available for generator compatibility assessment.",
          documentId: view.documentId
        })
      );
      continue;
    }

    let known = 0;
    for (const section of sections) {
      const type = section.sectionType || UNKNOWN_SECTION_TYPE;
      if (type !== UNKNOWN_SECTION_TYPE && SECTION_TYPE_LIST.includes(type)) {
        known += 1;
      } else {
        const matches = matchSectionTitle(buildHeadingKey(section.headingText));
        if (matches.length && matches[0].sectionType !== UNKNOWN_SECTION_TYPE) {
          known += 1;
        } else {
          findings.push(
            createFinding({
              rule: "GEN_UNKNOWN_SECTION",
              severity: SEVERITIES.INFO,
              category: VALIDATION_CATEGORIES.GENERATOR,
              dimension: QUALITY_DIMENSIONS.GENERATOR_COMPATIBILITY,
              message: `Section heading is not mapped to a generator-known section type: "${section.headingText}".`,
              documentId: view.documentId,
              sectionId: section.sectionId,
              blockId: section.headingBlockId,
              details: { headingText: section.headingText }
            })
          );
        }
      }
    }

    for (const required of CORE_RECRUITMENT_SECTIONS) {
      const present = sections.some((section) => section.sectionType === required);
      if (!present) {
        findings.push(
          createFinding({
            rule: "GEN_CORE_SECTION_MISSING",
            severity: SEVERITIES.WARNING,
            category: VALIDATION_CATEGORIES.GENERATOR,
            dimension: QUALITY_DIMENSIONS.GENERATOR_COMPATIBILITY,
            message: `Generator-preferred core section missing: ${required}.`,
            documentId: view.documentId,
            details: { sectionType: required }
          })
        );
      }
    }

    const ratio = sections.length ? known / sections.length : 0;
    if (ratio < 0.35) {
      findings.push(
        createFinding({
          rule: "GEN_LOW_SECTION_MAPPING",
          severity: SEVERITIES.WARNING,
          category: VALIDATION_CATEGORIES.GENERATOR,
          dimension: QUALITY_DIMENSIONS.GENERATOR_COMPATIBILITY,
          message: `Low generator section mapping ratio (${Math.round(ratio * 100)}%).`,
          documentId: view.documentId,
          details: { known, total: sections.length, ratio }
        })
      );
    }
  }

  return findings;
}

function validateCorrelationBundle(documents, correlation) {
  return [
    ...validateCorrelation(correlation, documents),
    ...validateRelationships(correlation),
    ...validateTimeline(correlation),
    ...validateCrossDocumentConsistency(documents, correlation),
    ...validateGeneratorCompatibility(documents)
  ];
}

module.exports = {
  validateCorrelationBundle,
  validateCorrelation,
  validateRelationships,
  validateTimeline,
  validateCrossDocumentConsistency,
  validateGeneratorCompatibility
};
