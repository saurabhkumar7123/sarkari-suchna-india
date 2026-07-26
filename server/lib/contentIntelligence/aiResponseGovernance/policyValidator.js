"use strict";

const { finding } = require("./governanceTypes");

function stableValue(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.map(stableValue).join(" ");
    return Object.keys(value)
      .sort()
      .map((key) => `${key} ${stableValue(value[key])}`)
      .join(" ");
  }
  return String(value);
}

function canonical(value) {
  return stableValue(value).replace(/\s+/g, " ").trim();
}

function collectContent(document) {
  const pieces = [stableValue(document && document.metadata)];
  for (const section of document && Array.isArray(document.sections) ? document.sections : []) {
    pieces.push(section.title || "", section.generatorTitle || "");
    for (const block of Array.isArray(section.blocks) ? section.blocks : []) {
      pieces.push(block.originalContent || "", stableValue(block.normalizedContent));
    }
  }
  return pieces.join("\n");
}

function uniqueMatches(text, regex) {
  return [...new Set((String(text).match(regex) || []).map((value) => value.trim()))].sort();
}

function facts(document) {
  const text = collectContent(document);
  return {
    dates: uniqueMatches(
      text,
      /\b(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})\b/gi
    ),
    urls: uniqueMatches(text, /https?:\/\/[^\s,|)\]}]+/gi),
    numbers: uniqueMatches(text, /(?:₹\s*)?\b\d+(?:[,.]\d+)*(?:\s*\/-|\s*%|\b)/g)
  };
}

function difference(left, right) {
  const rightSet = new Set(right.map((item) => item.toLowerCase()));
  return left.filter((item) => !rightSet.has(item.toLowerCase()));
}

function addFactFindings(output, baselineFacts, draftFacts, key, code, label) {
  const missing = difference(baselineFacts[key], draftFacts[key]);
  const added = difference(draftFacts[key], baselineFacts[key]);
  if (missing.length || added.length) {
    output.push(
      finding(code, "error", "policy", `${label} differ from the Stage 2B source payload.`, {
        added,
        missing,
        policyRule: `preserve_${key}`
      })
    );
  }
}

function metadataDifferences(baseline, draft, path = "metadata") {
  const output = [];
  if (!baseline || typeof baseline !== "object") return output;
  if (!draft || typeof draft !== "object") {
    output.push({ path, before: baseline, after: draft == null ? null : draft });
    return output;
  }
  for (const key of Object.keys(baseline).sort()) {
    const before = baseline[key];
    const after = draft[key];
    if (before && typeof before === "object" && !Array.isArray(before)) {
      output.push(...metadataDifferences(before, after, `${path}.${key}`));
    } else if (canonical(before) !== canonical(after)) {
      output.push({ path: `${path}.${key}`, before, after: after === undefined ? null : after });
    }
  }
  return output;
}

function validatePolicy(governedDraft, baselinePayload, draftPolicy) {
  const findings = [];
  const baseline = baselinePayload && typeof baselinePayload === "object" ? baselinePayload : null;
  if (!baseline) {
    findings.push(
      finding(
        "policy.baseline_unavailable",
        "warning",
        "policy",
        "Stage 2B structured payload was not supplied; factual preservation checks are limited."
      )
    );
    return { valid: true, findings, baselineAvailable: false };
  }

  const sourceSections = Array.isArray(baseline.sections) ? baseline.sections : [];
  const draftSections = Array.isArray(governedDraft.sections) ? governedDraft.sections : [];
  const used = new Set();

  sourceSections.forEach((source, sourceIndex) => {
    const matchIndex = draftSections.findIndex(
      (candidate, index) =>
        !used.has(index) && candidate && candidate.sectionType === source.sectionType
    );
    if (matchIndex < 0) {
      findings.push(
        finding(
          "policy.section_removed",
          "error",
          "policy",
          `Required source section was removed: ${source.sectionType}.`,
          {
            path: `sections[${sourceIndex}]`,
            policyRule: "do_not_remove_sections",
            sectionType: source.sectionType
          }
        )
      );
      return;
    }
    used.add(matchIndex);
    const sourceBlocks = Array.isArray(source.blocks) ? source.blocks : [];
    const draftBlocks = Array.isArray(draftSections[matchIndex].blocks)
      ? draftSections[matchIndex].blocks
      : [];
    if (draftBlocks.length < sourceBlocks.length) {
      findings.push(
        finding(
          "policy.content_deleted",
          "error",
          "policy",
          `Content was deleted from section ${source.sectionType}.`,
          {
            actualBlocks: draftBlocks.length,
            expectedBlocks: sourceBlocks.length,
            sectionType: source.sectionType
          }
        )
      );
    } else if (draftBlocks.length > sourceBlocks.length) {
      findings.push(
        finding(
          "policy.unexpected_content",
          "warning",
          "policy",
          `Additional content was added to section ${source.sectionType}.`,
          {
            actualBlocks: draftBlocks.length,
            expectedBlocks: sourceBlocks.length,
            sectionType: source.sectionType
          }
        )
      );
    }
    sourceBlocks.forEach((block, blockIndex) => {
      const candidate = draftBlocks[blockIndex];
      if (!candidate) return;
      if (
        canonical(block.originalContent) !== canonical(candidate.originalContent) ||
        canonical(block.normalizedContent) !== canonical(candidate.normalizedContent)
      ) {
        findings.push(
          finding(
            "policy.content_changed",
            "error",
            "policy",
            "Source block content was changed.",
            {
              path: `sections[${matchIndex}].blocks[${blockIndex}]`,
              policyRule: "preserve_factual_content",
              sectionType: source.sectionType
            }
          )
        );
      }
      if (block.blockType !== candidate.blockType) {
        findings.push(
          finding(
            "policy.generator_format_changed",
            "warning",
            "policy",
            "Source block type was changed.",
            {
              actual: candidate.blockType,
              expected: block.blockType,
              path: `sections[${matchIndex}].blocks[${blockIndex}].blockType`,
              policyRule: "respect_generator_formatting"
            }
          )
        );
      }
    });
  });

  draftSections.forEach((section, index) => {
    if (!used.has(index)) {
      findings.push(
        finding(
          "policy.unexpected_section",
          "warning",
          "policy",
          `Unexpected additional section: ${section && section.sectionType}.`,
          {
            path: `sections[${index}]`,
            policyRule: "do_not_invent_information",
            sectionType: section && section.sectionType
          }
        )
      );
    }
  });

  const expectedMetadata = baseline.normalizedMetadata;
  const metadataChanges = metadataDifferences(expectedMetadata, governedDraft.metadata);
  if (expectedMetadata && !governedDraft.metadata) {
    findings.push(
      finding("policy.metadata_removed", "error", "policy", "Source metadata was removed.", {
        policyRule: "preserve_factual_content"
      })
    );
  }
  metadataChanges.forEach((change) => {
    const isOrganization = /\.organization$/i.test(change.path);
    findings.push(
      finding(
        isOrganization ? "policy.organization_changed" : "policy.metadata_changed",
        "error",
        "policy",
        `${isOrganization ? "Organization name" : "Metadata value"} changed from the source payload.`,
        change
      )
    );
  });

  const sourceFacts = facts({ metadata: expectedMetadata, sections: sourceSections });
  const outputFacts = facts(governedDraft);
  addFactFindings(findings, sourceFacts, outputFacts, "dates", "policy.dates_changed", "Dates");
  addFactFindings(
    findings,
    sourceFacts,
    outputFacts,
    "numbers",
    "policy.numbers_changed",
    "Numbers"
  );
  addFactFindings(findings, sourceFacts, outputFacts, "urls", "policy.urls_changed", "URLs");

  const hallucination = findings.some((item) =>
    ["policy.unexpected_content", "policy.unexpected_section"].includes(item.code)
  );
  if (hallucination) {
    findings.push(
      finding(
        "policy.potential_hallucination",
        "warning",
        "policy",
        "Additional sections or blocks may contain information absent from the source payload.",
        { policyRule: "do_not_invent_information" }
      )
    );
  }

  const policyId = draftPolicy && draftPolicy.id ? draftPolicy.id : null;
  return {
    valid: !findings.some((item) => item.severity === "error"),
    findings,
    baselineAvailable: true,
    policyId
  };
}

module.exports = { validatePolicy, collectContent, facts, metadataDifferences };
