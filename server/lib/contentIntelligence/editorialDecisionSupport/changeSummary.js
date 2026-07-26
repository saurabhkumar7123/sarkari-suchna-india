"use strict";

/**
 * CIP Stage 2E — Deterministic change summary for editor review.
 * Summarizes structural / metadata / compatibility changes only.
 * Never rewrites content.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pushUnique(list, item) {
  if (!list.includes(item)) list.push(item);
}

function buildChangeSummary({
  analysis,
  generatorReadyDocument,
  governanceResult = null
}) {
  const importantMetadataChanges = [];
  const sectionAdditions = [];
  const sectionRemovals = [];
  const unknownSections = [];
  const unknownBlocks = [];
  const orderingRepairs = [];
  const structuralRepairs = [];
  const generatorCompatibilityIssues = [];
  const policyViolations = [];

  const findings = asArray(analysis && analysis.allFindings);
  const summary = (generatorReadyDocument && generatorReadyDocument.transformationSummary) || {};
  const sections = asArray(
    (generatorReadyDocument && generatorReadyDocument.mappedSections) ||
      (generatorReadyDocument && generatorReadyDocument.sections)
  );

  findings.forEach((item) => {
    const code = String(item.code || "");
    const message = String(item.message || code);

    if (code.startsWith("policy.")) {
      if (/metadata|organization|dates|numbers|urls|title/i.test(code)) {
        pushUnique(importantMetadataChanges, message);
      }
      if (/section_removed|section_added|unexpected/i.test(code)) {
        if (/removed|missing/i.test(code)) pushUnique(sectionRemovals, message);
        else pushUnique(sectionAdditions, message);
      }
      pushUnique(policyViolations, message);
    }

    if (code === "editorial.metadata_missing" || /metadata_missing|metadata_removed/i.test(code)) {
      pushUnique(importantMetadataChanges, message);
    }

    if (
      code === "transform.unknown_section_preserved" ||
      code === "compat.unknown_section" ||
      code === "generator.unsupported_section"
    ) {
      pushUnique(
        unknownSections,
        item.sectionType
          ? `Unknown section preserved: ${item.sectionType}`
          : message
      );
    }

    if (
      code === "transform.unknown_block_preserved" ||
      code === "compat.unknown_block" ||
      code === "generator.unsupported_block"
    ) {
      pushUnique(
        unknownBlocks,
        item.blockType ? `Unknown block preserved: ${item.blockType}` : message
      );
    }

    if (/order|ordering/i.test(code)) {
      pushUnique(orderingRepairs, message);
    }

    if (/repair|schema\.|structural/i.test(code) || (item.source || "").includes("repair")) {
      pushUnique(structuralRepairs, message);
    }

    if (code.startsWith("generator.") || (item.category || "") === "generator") {
      pushUnique(generatorCompatibilityIssues, message);
    }
  });

  asArray(governanceResult && governanceResult.repairsApplied).forEach((repair) => {
    const msg =
      typeof repair === "string"
        ? repair
        : repair && repair.message
          ? repair.message
          : JSON.stringify(repair);
    if (/order/i.test(msg)) pushUnique(orderingRepairs, msg);
    else pushUnique(structuralRepairs, msg);
  });

  sections.forEach((section) => {
    if (section.knownSection === false) {
      pushUnique(
        unknownSections,
        `Unknown section preserved: ${section.sectionType || section.generatorTitle || "untitled"}`
      );
    }
    asArray(section.blocks).forEach((block) => {
      if (block.knownBlock === false) {
        pushUnique(
          unknownBlocks,
          `Unknown block preserved: ${block.blockType || "unknown"}`
        );
      }
    });
  });

  if (summary.unknownSectionCount > 0 && !unknownSections.length) {
    pushUnique(unknownSections, `${summary.unknownSectionCount} unknown section(s) preserved.`);
  }
  if (summary.unknownBlockCount > 0 && !unknownBlocks.length) {
    pushUnique(unknownBlocks, `${summary.unknownBlockCount} unknown block(s) preserved.`);
  }

  const lines = [];
  const addGroup = (label, items) => {
    if (!items.length) return;
    lines.push(`${label}: ${items.length}`);
    items.forEach((item) => lines.push(`- ${item}`));
  };

  addGroup("Important metadata changes", importantMetadataChanges);
  addGroup("Section additions", sectionAdditions);
  addGroup("Section removals", sectionRemovals);
  addGroup("Unknown sections", unknownSections);
  addGroup("Unknown blocks", unknownBlocks);
  addGroup("Ordering repairs", orderingRepairs);
  addGroup("Structural repairs", structuralRepairs);
  addGroup("Generator compatibility issues", generatorCompatibilityIssues);
  addGroup("Policy violations", policyViolations);

  if (!lines.length) {
    lines.push("No material editorial changes detected.");
  }

  return {
    importantMetadataChanges,
    sectionAdditions,
    sectionRemovals,
    unknownSections,
    unknownBlocks,
    orderingRepairs,
    structuralRepairs,
    generatorCompatibilityIssues,
    policyViolations,
    text: lines.join("\n"),
    hasChanges:
      importantMetadataChanges.length +
        sectionAdditions.length +
        sectionRemovals.length +
        unknownSections.length +
        unknownBlocks.length +
        orderingRepairs.length +
        structuralRepairs.length +
        generatorCompatibilityIssues.length +
        policyViolations.length >
      0
  };
}

module.exports = { buildChangeSummary };
