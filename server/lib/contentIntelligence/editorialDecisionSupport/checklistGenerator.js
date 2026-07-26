"use strict";

/**
 * CIP Stage 2E — Relevant-only editor review checklist generation.
 */

const { explanation } = require("./decisionTypes");

function hasSection(sections, type) {
  return (sections || []).some((s) => s.sectionType === type);
}

function hasFindingCode(findings, pattern) {
  const re = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
  return (findings || []).some((f) => re.test(String(f.code || "")) || re.test(String(f.message || "")));
}

function item(id, label, sectionType, reason, supportingFinding, severity) {
  return {
    id,
    label,
    relevant: true,
    affectedSection: sectionType || null,
    explanation: explanation(reason, supportingFinding, severity || "info", sectionType || null)
  };
}

function generateReviewChecklist(analysis, generatorReadyDocument) {
  const sections =
    (generatorReadyDocument && generatorReadyDocument.mappedSections) ||
    (generatorReadyDocument && generatorReadyDocument.sections) ||
    [];
  const findings = (analysis && analysis.allFindings) || [];
  const documentType = (analysis && analysis.documentType) || "unknown";
  const checklist = [];

  const datesRelevant =
    hasSection(sections, "important_dates") ||
    (analysis &&
      analysis.metadataCompleteness &&
      (analysis.metadataCompleteness.requiredFields || []).includes("importantDates")) ||
    hasFindingCode(findings, /dates/i);
  if (datesRelevant) {
    checklist.push(
      item(
        "verify_important_dates",
        "Verify important dates",
        "important_dates",
        "Document includes date fields or date-related findings.",
        "important_dates|dates_finding",
        hasFindingCode(findings, /dates/i) ? "warning" : "info"
      )
    );
  }

  if (hasSection(sections, "vacancy_details") || hasFindingCode(findings, /vacancy|numbers/i)) {
    checklist.push(
      item(
        "verify_vacancy_count",
        "Verify vacancy count",
        "vacancy_details",
        "Vacancy details section or numeric findings are present.",
        "vacancy_details|numbers_finding",
        hasFindingCode(findings, /numbers|vacancy/i) ? "warning" : "info"
      )
    );
  }

  if (
    hasSection(sections, "qualification") ||
    hasSection(sections, "age_limit") ||
    documentType === "new_recruitment"
  ) {
    if (hasSection(sections, "qualification") || hasSection(sections, "age_limit")) {
      checklist.push(
        item(
          "verify_eligibility",
          "Verify eligibility",
          hasSection(sections, "qualification") ? "qualification" : "age_limit",
          "Eligibility-related sections are present for this document.",
          "qualification|age_limit",
          "info"
        )
      );
    }
  }

  if (hasSection(sections, "application_fee") || hasFindingCode(findings, /fee/i)) {
    checklist.push(
      item(
        "verify_application_fee",
        "Verify application fee",
        "application_fee",
        "Application fee section or fee-related findings are present.",
        "application_fee",
        "info"
      )
    );
  }

  if (hasSection(sections, "important_links") || hasFindingCode(findings, /url|link|grammar/i)) {
    checklist.push(
      item(
        "verify_links",
        "Verify links",
        "important_links",
        "Important links section or link/URL findings are present.",
        "important_links|urls_finding",
        hasFindingCode(findings, /url|link|grammar/i) ? "warning" : "info"
      )
    );
  }

  if (
    (analysis && analysis.organization) ||
    (analysis &&
      analysis.metadataCompleteness &&
      (analysis.metadataCompleteness.requiredFields || []).includes("organization")) ||
    hasFindingCode(findings, /organization/i)
  ) {
    checklist.push(
      item(
        "verify_organization",
        "Verify organization",
        null,
        "Organization metadata is present or required for this document type.",
        "metadata.organization",
        hasFindingCode(findings, /organization/i) ? "warning" : "info"
      )
    );
  }

  const title = (analysis && analysis.title) || "";
  if (/notification|advt|advertisement|no\.|number/i.test(title) || hasFindingCode(findings, /notification/i)) {
    checklist.push(
      item(
        "verify_notification_number",
        "Verify notification number",
        "short_information",
        "Title or findings suggest a notification identifier should be checked.",
        "title|notification",
        "info"
      )
    );
  }

  if (documentType === "result" || hasSection(sections, "result")) {
    checklist.push(
      item(
        "verify_result_status",
        "Verify result status",
        "result",
        "Document type or Result section requires result-status verification.",
        "result",
        "info"
      )
    );
  }

  if (documentType === "admit_card" || hasSection(sections, "admit_card")) {
    checklist.push(
      item(
        "verify_admit_card_details",
        "Verify admit card details",
        "admit_card",
        "Admit card document requires download/status verification.",
        "admit_card",
        "info"
      )
    );
  }

  if (documentType === "answer_key" || hasSection(sections, "answer_key")) {
    checklist.push(
      item(
        "verify_answer_key",
        "Verify answer key details",
        "answer_key",
        "Answer key document requires release verification.",
        "answer_key",
        "info"
      )
    );
  }

  if (analysis && analysis.unknownSectionCount > 0) {
    checklist.push(
      item(
        "verify_unknown_sections",
        "Verify unknown sections",
        null,
        "Unknown sections were preserved and need editorial confirmation.",
        "unknownSectionCount",
        "warning"
      )
    );
  }

  if (analysis && analysis.unknownBlockCount > 0) {
    checklist.push(
      item(
        "verify_unknown_blocks",
        "Verify unknown blocks",
        null,
        "Unknown blocks were preserved and need editorial confirmation.",
        "unknownBlockCount",
        "warning"
      )
    );
  }

  if (
    analysis &&
    analysis.generatorCompatibility &&
    analysis.generatorCompatibility.status !== "compatible"
  ) {
    checklist.push(
      item(
        "verify_generator_compatibility",
        "Verify Generator compatibility issues",
        null,
        "Generator compatibility is not fully compatible.",
        `generatorCompatibility=${analysis.generatorCompatibility.status}`,
        "error"
      )
    );
  }

  if (analysis && analysis.policyFindings && analysis.policyFindings.length) {
    checklist.push(
      item(
        "verify_policy_findings",
        "Verify policy findings against source",
        null,
        "Policy findings require comparison with the source package.",
        "policyFindings",
        "error"
      )
    );
  }

  // Always remind: never auto-approve
  checklist.push(
    item(
      "manual_approval_required",
      "Complete manual approval before publish",
      null,
      "Publishing requires mandatory human approval; engine never auto-approves.",
      "manual_approval",
      "info"
    )
  );

  return checklist;
}

module.exports = { generateReviewChecklist };
