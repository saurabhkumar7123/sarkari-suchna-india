"use strict";

/**
 * CIP Stage 2E — Editorial analysis of a Generator-ready document.
 * Read-only. Does not modify content or publish.
 */

const {
  getRequiredMetadata,
  getRequiredSections
} = require("../validationEngine/validationRules");
const { getDocumentTypeLabel } = require("../documentClassification/documentTypes");
const {
  EDITORIAL_RISK_LEVELS,
  RISK_RANK,
  PUBLISH_READINESS_STATES,
  SEVERITIES,
  finding
} = require("./decisionTypes");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickDocumentType(doc, metadata, governanceResult) {
  return (
    (metadata && (metadata.documentType || metadata.detectedDocumentType)) ||
    (doc && doc.documentType) ||
    (governanceResult &&
      governanceResult.governedDraft &&
      governanceResult.governedDraft.document &&
      governanceResult.governedDraft.document.documentType) ||
    "unknown"
  );
}

function metadataCompleteness(documentType, metadata) {
  const required = getRequiredMetadata(documentType) || [];
  const present = [];
  const missing = [];
  const meta = metadata || {};

  required.forEach((field) => {
    let value = null;
    if (field === "title") value = meta.title;
    else if (field === "organization") value = meta.organization;
    else if (field === "detectedDocumentType")
      value = meta.detectedDocumentType || meta.documentType;
    else if (field === "importantDates") value = meta.importantDates;
    else value = meta[field];

    const empty =
      value == null ||
      value === "" ||
      (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length);

    if (empty) missing.push(field);
    else present.push(field);
  });

  const requiredCount = required.length;
  const completenessRatio =
    requiredCount === 0 ? 1 : Number((present.length / requiredCount).toFixed(4));

  return {
    documentType,
    requiredFields: required.slice(),
    presentFields: present,
    missingFields: missing,
    requiredCount,
    presentCount: present.length,
    missingCount: missing.length,
    complete: missing.length === 0,
    completenessRatio
  };
}

function sectionPresence(documentType, sections) {
  const required = getRequiredSections(documentType) || [];
  const types = asArray(sections).map((s) => s.sectionType);
  const present = required.filter((t) => types.includes(t));
  const missing = required.filter((t) => !types.includes(t));
  return {
    requiredSections: required.slice(),
    presentRequiredSections: present,
    missingRequiredSections: missing,
    complete: missing.length === 0
  };
}

function collectFindings(generatorReadyDocument, governanceResult, validationResult) {
  const findings = [];
  const compat = (generatorReadyDocument && generatorReadyDocument.generatorCompatibility) || {};
  asArray(compat.findings).forEach((item) => {
    findings.push({
      ...item,
      category: item.category || "generator",
      source: "generatorCompatibility"
    });
  });
  asArray(generatorReadyDocument && generatorReadyDocument.transformationWarnings).forEach(
    (item) => {
      findings.push({
        code: item.code,
        severity: item.severity || SEVERITIES.WARNING,
        category: "transformation",
        message: item.message,
        path: item.path,
        sectionType: item.sectionType,
        blockType: item.blockType,
        source: "transformationWarnings"
      });
    }
  );
  asArray(compat.preservationWarnings).forEach((item) => {
    findings.push({
      code: item.code,
      severity: item.severity || SEVERITIES.INFO,
      category: "transformation",
      message: item.message,
      path: item.path,
      sectionType: item.sectionType,
      blockType: item.blockType,
      source: "preservationWarnings"
    });
  });

  if (governanceResult) {
    asArray(governanceResult.validationFindings).forEach((item) => {
      findings.push({ ...item, category: item.category || "schema", source: "governance.validation" });
    });
    asArray(governanceResult.policyFindings).forEach((item) => {
      findings.push({ ...item, category: item.category || "policy", source: "governance.policy" });
    });
    asArray(
      governanceResult.generatorCompatibility && governanceResult.generatorCompatibility.findings
    ).forEach((item) => {
      findings.push({
        ...item,
        category: item.category || "generator",
        source: "governance.generator"
      });
    });
  }

  if (validationResult) {
    asArray(validationResult.findings || validationResult.allFindings).forEach((item) => {
      findings.push({
        ...item,
        category: item.category || "validation",
        source: "validation"
      });
    });
  }

  return findings;
}

function deriveQualityScores(findings, validationResult) {
  if (validationResult && validationResult.scores) {
    return {
      overall: validationResult.scores.overall,
      metadata: validationResult.scores.metadata,
      section: validationResult.scores.section,
      block: validationResult.scores.block,
      generatorCompatibility: validationResult.scores.generatorCompatibility,
      publishReadiness: validationResult.scores.publishReadiness,
      source: "validation"
    };
  }

  let score = 100;
  findings.forEach((item) => {
    if (item.severity === SEVERITIES.ERROR) score -= 12;
    else if (item.severity === SEVERITIES.WARNING) score -= 4;
    else if (item.severity === SEVERITIES.INFO) score -= 1;
  });
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  score = Math.round(score);

  return {
    overall: score,
    metadata: score,
    section: score,
    block: score,
    generatorCompatibility: score,
    publishReadiness: score,
    source: "derived"
  };
}

function mapRiskFromSeverity(severity) {
  if (severity === SEVERITIES.ERROR) return EDITORIAL_RISK_LEVELS.HIGH;
  if (severity === SEVERITIES.WARNING) return EDITORIAL_RISK_LEVELS.MEDIUM;
  return EDITORIAL_RISK_LEVELS.LOW;
}

function elevateRisk(code, base) {
  const critical = [
    "policy.dates_changed",
    "policy.numbers_changed",
    "policy.urls_changed",
    "policy.organization_changed",
    "schema.invalid_root",
    "schema.version_incompatible"
  ];
  if (critical.includes(code)) return EDITORIAL_RISK_LEVELS.CRITICAL;
  if (
    String(code || "").startsWith("generator.") &&
    (base === EDITORIAL_RISK_LEVELS.HIGH || base === EDITORIAL_RISK_LEVELS.MEDIUM)
  ) {
    return EDITORIAL_RISK_LEVELS.HIGH;
  }
  return base;
}

function assessRisk(findings, generatorCompatibility, governanceResult) {
  const risks = findings.map((item) => {
    const level = elevateRisk(item.code, mapRiskFromSeverity(item.severity));
    return {
      code: item.code,
      level,
      category: item.category || null,
      message: item.message,
      path: item.path == null ? null : item.path,
      source: item.source || null
    };
  });

  let overall = EDITORIAL_RISK_LEVELS.LOW;
  risks.forEach((risk) => {
    if (RISK_RANK[risk.level] > RISK_RANK[overall]) overall = risk.level;
  });

  if (
    governanceResult &&
    governanceResult.editorialRisks &&
    governanceResult.editorialRisks.overall
  ) {
    const upstream = governanceResult.editorialRisks.overall;
    if (RISK_RANK[upstream] > RISK_RANK[overall]) overall = upstream;
  }

  if (
    generatorCompatibility &&
    generatorCompatibility.status === "incompatible" &&
    RISK_RANK[overall] < RISK_RANK[EDITORIAL_RISK_LEVELS.HIGH]
  ) {
    overall = EDITORIAL_RISK_LEVELS.HIGH;
  }

  return { overall, findings: risks };
}

function derivePublishReadiness(
  overallRisk,
  generatorCompatibility,
  qualityScores,
  metadataComplete,
  sectionsComplete,
  governanceResult
) {
  if (validationBlocked(governanceResult, overallRisk, generatorCompatibility)) {
    return {
      status: PUBLISH_READINESS_STATES.BLOCKED,
      ready: false,
      reason: "Critical risk or Generator incompatibility blocks publish readiness."
    };
  }

  if (
    overallRisk === EDITORIAL_RISK_LEVELS.HIGH ||
    overallRisk === EDITORIAL_RISK_LEVELS.MEDIUM ||
    !metadataComplete ||
    !sectionsComplete ||
    (qualityScores.overall != null && qualityScores.overall < 75) ||
    (generatorCompatibility && generatorCompatibility.status === "partial")
  ) {
    return {
      status: PUBLISH_READINESS_STATES.NEEDS_REVIEW,
      ready: false,
      reason: "Findings require human editorial review before any publish decision."
    };
  }

  return {
    status: PUBLISH_READINESS_STATES.READY,
    ready: true,
    reason: "No blocking editorial findings; human approval remains mandatory."
  };
}

function validationBlocked(governanceResult, overallRisk, generatorCompatibility) {
  if (overallRisk === EDITORIAL_RISK_LEVELS.CRITICAL) return true;
  if (generatorCompatibility && generatorCompatibility.status === "incompatible") return true;
  if (
    governanceResult &&
    governanceResult.readinessStatus &&
    governanceResult.readinessStatus.status === PUBLISH_READINESS_STATES.BLOCKED
  ) {
    return true;
  }
  return false;
}

function analyzeEditorialDocument({
  generatorReadyDocument,
  governanceResult = null,
  validationResult = null
}) {
  const doc = generatorReadyDocument || {};
  const metadata = doc.generatorMetadata || doc.metadata || {};
  const sections = doc.mappedSections || doc.sections || [];
  const summary = doc.transformationSummary || {};
  const compat = doc.generatorCompatibility || {};
  const documentType = pickDocumentType(doc, metadata, governanceResult);
  const documentTypeLabel = getDocumentTypeLabel(documentType);

  const metadataReport = metadataCompleteness(documentType, metadata);
  const sectionReport = sectionPresence(documentType, sections);
  const allFindings = collectFindings(doc, governanceResult, validationResult);

  if (!metadataReport.complete) {
    metadataReport.missingFields.forEach((field) => {
      allFindings.push(
        finding(
          "editorial.metadata_missing",
          SEVERITIES.WARNING,
          "metadata",
          `Required metadata field missing: ${field}.`,
          { field, source: "editorialAnalysis" }
        )
      );
    });
  }
  if (!sectionReport.complete) {
    sectionReport.missingRequiredSections.forEach((sectionType) => {
      allFindings.push(
        finding(
          "editorial.required_section_missing",
          SEVERITIES.ERROR,
          "section",
          `Required section missing for ${documentType}: ${sectionType}.`,
          { sectionType, source: "editorialAnalysis" }
        )
      );
    });
  }

  const qualityScores = deriveQualityScores(allFindings, validationResult);
  const editorialRisk = assessRisk(allFindings, compat, governanceResult);
  const publishReadiness = derivePublishReadiness(
    editorialRisk.overall,
    compat,
    qualityScores,
    metadataReport.complete,
    sectionReport.complete,
    governanceResult
  );

  const unknownSections = asArray(sections).filter(
    (s) => s.knownSection === false || s.sectionType === "unknown"
  );
  const unknownBlocks = asArray(sections).flatMap((s) =>
    asArray(s.blocks).filter((b) => b.knownBlock === false || b.blockType === "unknown")
  );

  // Prefer explicit knownSection/knownBlock flags when present; otherwise count from summary.
  const unknownSectionCount =
    summary.unknownSectionCount != null
      ? summary.unknownSectionCount
      : unknownSections.length;
  const unknownBlockCount =
    summary.unknownBlockCount != null ? summary.unknownBlockCount : unknownBlocks.length;

  return {
    documentType,
    documentTypeLabel,
    title: metadata.title || null,
    organization: metadata.organization != null ? metadata.organization : null,
    postHint: extractPostHint(metadata, sections),
    metadataCompleteness: metadataReport,
    sectionCompleteness: sectionReport,
    validationFindings: allFindings.filter(
      (f) => f.source === "validation" || f.source === "governance.validation"
    ),
    policyFindings: allFindings.filter((f) => f.source === "governance.policy"),
    generatorCompatibility: {
      status: compat.status || "compatible",
      compatible: compat.compatible !== false,
      findings: asArray(compat.findings),
      summary: compat.summary || null
    },
    qualityScores,
    publishReadiness,
    editorialRisk,
    transformationWarnings: asArray(doc.transformationWarnings),
    unknownSectionCount,
    unknownBlockCount,
    sectionCount: asArray(sections).length,
    blockCount: asArray(sections).reduce((sum, s) => sum + asArray(s.blocks).length, 0),
    allFindings,
    analysisNotes: [
      "Editorial analysis is advisory only.",
      "Manual approval remains mandatory.",
      "Engine never publishes or modifies content."
    ]
  };
}

function extractPostHint(metadata, sections) {
  if (metadata && metadata.title) {
    const title = String(metadata.title);
    const match = title.match(/\b([A-Za-z][A-Za-z0-9 /-]{2,40})\s+Recruitment\b/i);
    if (match) return match[1].trim();
  }
  const vacancy = asArray(sections).find((s) => s.sectionType === "vacancy_details");
  if (vacancy && vacancy.body) {
    const line = String(vacancy.body)
      .split(/\n/)
      .find((l) => /post/i.test(l) && !/---/.test(l));
    if (line) return line.trim().slice(0, 80);
  }
  return null;
}

module.exports = {
  analyzeEditorialDocument,
  metadataCompleteness,
  sectionPresence,
  collectFindings,
  deriveQualityScores,
  assessRisk
};
