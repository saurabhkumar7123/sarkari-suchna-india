"use strict";

/**
 * CIP Stage 1E — block validation.
 * Validates Stage 1D blocks; reuses Generator URL helper. Never modifies content.
 */

const {
  isKnownBlockType,
  UNKNOWN_BLOCK_TYPE,
  BLOCK_TYPES,
  SECTION_TYPES
} = require("../structureIntelligence/structureTypes");
const { isUrlLike } = require("../../../../generator/lib/parseLinkLineParts");
const { SEVERITIES, VALIDATION_CATEGORIES, createFinding } = require("./validationTypes");
const { ISO_DATE_RE } = require("./validationRules");

const LINK_ASSIGNMENT_RE = /^([^:=\n]{1,80})\s*=\s*(\S.+)$/;

function validateLinkTargets(links, findings, path, sectionOrder, blockOrder) {
  for (let i = 0; i < links.length; i += 1) {
    const link = links[i];
    if (link.multi) {
      for (const action of link.actions || []) {
        if (!isUrlLike(action.url)) {
          findings.push(
            createFinding(
              "BLK_BROKEN_LINK",
              SEVERITIES.ERROR,
              VALIDATION_CATEGORIES.BLOCK,
              `Broken multi-link URL at action "${action.buttonText || ""}".`,
              {
                path,
                sectionOrder,
                blockOrder,
                blockType: BLOCK_TYPES.MULTI_LINK,
                details: { url: action.url, linkIndex: i }
              }
            )
          );
        }
      }
    } else if (!isUrlLike(link.url)) {
      findings.push(
        createFinding(
          "BLK_BROKEN_LINK",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.BLOCK,
          `Broken link URL${link.label ? ` for "${link.label}"` : ""}.`,
          {
            path,
            sectionOrder,
            blockOrder,
            blockType: BLOCK_TYPES.LINK,
            details: { url: link.url, linkIndex: i }
          }
        )
      );
    }
  }
}

function validateOneBlock(block, section, findings) {
  const sectionOrder = section.order;
  const blockOrder = block.order;
  const path = `sections[${sectionOrder}].blocks[${blockOrder}]`;
  const blockType = block.blockType || UNKNOWN_BLOCK_TYPE;

  if (blockType === UNKNOWN_BLOCK_TYPE || !isKnownBlockType(blockType)) {
    findings.push(
      createFinding(
        "BLK_UNKNOWN_TYPE",
        SEVERITIES.WARNING,
        VALIDATION_CATEGORIES.BLOCK,
        `Unknown block type "${blockType}".`,
        { path, sectionOrder, blockOrder, blockType }
      )
    );
  }

  const original = String(block.originalContent || "").trim();
  if (!original) {
    findings.push(
      createFinding(
        "BLK_EMPTY",
        SEVERITIES.ERROR,
        VALIDATION_CATEGORIES.BLOCK,
        `Empty block at section ${sectionOrder}, block ${blockOrder}.`,
        { path, sectionOrder, blockOrder, blockType }
      )
    );
  }

  const content = block.normalizedContent || {};

  if (blockType === BLOCK_TYPES.TABLE) {
    const rowCount = content.rowCount != null ? content.rowCount : (content.grid || []).length;
    const columnCount = content.columnCount != null
      ? content.columnCount
      : content.grid && content.grid[0]
        ? content.grid[0].length
        : 0;
    if (!rowCount) {
      findings.push(
        createFinding(
          "BLK_INVALID_TABLE",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.BLOCK,
          "Table block has no rows.",
          { path, sectionOrder, blockOrder, blockType }
        )
      );
    } else if (columnCount < 2) {
      findings.push(
        createFinding(
          "BLK_INVALID_TABLE",
          SEVERITIES.WARNING,
          VALIDATION_CATEGORIES.BLOCK,
          "Table block has fewer than 2 columns.",
          { path, sectionOrder, blockOrder, blockType, details: { rowCount, columnCount } }
        )
      );
    }
    if (Array.isArray(content.grid) && content.grid.length) {
      const widths = new Set(content.grid.map((row) => row.length));
      if (widths.size > 1) {
        findings.push(
          createFinding(
            "BLK_INVALID_TABLE",
            SEVERITIES.WARNING,
            VALIDATION_CATEGORIES.BLOCK,
            "Table rows have inconsistent column counts.",
            { path, sectionOrder, blockOrder, blockType }
          )
        );
      }
    }
  }

  if (blockType === BLOCK_TYPES.FAQ) {
    const pairs = content.pairs || [];
    if (!pairs.length) {
      findings.push(
        createFinding(
          "BLK_INVALID_FAQ",
          SEVERITIES.ERROR,
          VALIDATION_CATEGORIES.BLOCK,
          "FAQ block has no question/answer pairs.",
          { path, sectionOrder, blockOrder, blockType }
        )
      );
    }
    for (const pair of pairs) {
      if (!pair.question || !pair.answer) {
        findings.push(
          createFinding(
            "BLK_INVALID_FAQ",
            SEVERITIES.ERROR,
            VALIDATION_CATEGORIES.BLOCK,
            "FAQ pair is missing a question or answer.",
            {
              path,
              sectionOrder,
              blockOrder,
              blockType,
              details: { question: pair.question || null, hasAnswer: Boolean(pair.answer) }
            }
          )
        );
      }
    }
  }

  if (blockType === BLOCK_TYPES.LINK || blockType === BLOCK_TYPES.MULTI_LINK) {
    validateLinkTargets(content.links || [], findings, path, sectionOrder, blockOrder);
  }

  // Important Links: Label=target lines that Stage 1D left as paragraph/kv
  // because the target failed isUrlLike — still report as broken links.
  if (section.sectionType === SECTION_TYPES.IMPORTANT_LINKS) {
    const lines = original.split("\n");
    for (const line of lines) {
      const match = String(line || "").trim().match(LINK_ASSIGNMENT_RE);
      if (!match) continue;
      const target = match[2].trim();
      if (target && !isUrlLike(target)) {
        findings.push(
          createFinding(
            "BLK_BROKEN_LINK",
            SEVERITIES.ERROR,
            VALIDATION_CATEGORIES.BLOCK,
            `Broken link target for "${match[1].trim()}".`,
            {
              path,
              sectionOrder,
              blockOrder,
              blockType,
              details: { label: match[1].trim(), url: target }
            }
          )
        );
      }
    }
  }

  if (blockType === BLOCK_TYPES.DATE_ROW) {
    const rows = content.rows || [];
    for (const row of rows) {
      if (!row.isDate) continue;
      if (!row.value) {
        findings.push(
          createFinding(
            "BLK_INVALID_DATE_ROW",
            SEVERITIES.ERROR,
            VALIDATION_CATEGORIES.BLOCK,
            `Date row "${row.label}" has no value.`,
            { path, sectionOrder, blockOrder, blockType, details: { label: row.label } }
          )
        );
        continue;
      }
      const normalized = row.normalizedValue;
      // Accept ISO or any preserved normalized string that still looks date-like;
      // flag when the value is present but clearly not date-parseable (same as raw garbage).
      if (
        normalized &&
        ISO_DATE_RE.test(String(normalized)) === false &&
        String(normalized).trim() === String(row.value).trim() &&
        !/\d/.test(String(row.value))
      ) {
        findings.push(
          createFinding(
            "BLK_INVALID_DATE_ROW",
            SEVERITIES.WARNING,
            VALIDATION_CATEGORIES.BLOCK,
            `Date row "${row.label}" value does not look like a date.`,
            {
              path,
              sectionOrder,
              blockOrder,
              blockType,
              details: { label: row.label, value: row.value }
            }
          )
        );
      }
    }
  }

  if (blockType === BLOCK_TYPES.MIXED) {
    findings.push(
      createFinding(
        "BLK_MIXED_CONTENT",
        SEVERITIES.WARNING,
        VALIDATION_CATEGORIES.BLOCK,
        "Mixed content block may need editorial review before Generator rendering.",
        { path, sectionOrder, blockOrder, blockType }
      )
    );
  }

  if (blockType === BLOCK_TYPES.RICH_TEXT || block.hasRichMarkup) {
    findings.push(
      createFinding(
        "BLK_RICH_TEXT",
        SEVERITIES.INFO,
        VALIDATION_CATEGORIES.GENERATOR,
        "Rich-text markup present; Generator must preserve inline tags.",
        { path, sectionOrder, blockOrder, blockType: blockType || BLOCK_TYPES.RICH_TEXT }
      )
    );
  }

  // Content preservation: originalContent should be non-empty when normalized payload exists
  if (original && block.normalizedContent == null) {
    findings.push(
      createFinding(
        "BLK_CONTENT_PRESERVATION",
        SEVERITIES.WARNING,
        VALIDATION_CATEGORIES.BLOCK,
        "Block has originalContent but missing normalizedContent.",
        { path, sectionOrder, blockOrder, blockType }
      )
    );
  }

  // Surface block-engine warnings as info
  if (Array.isArray(block.warnings)) {
    for (const warning of block.warnings) {
      findings.push(
        createFinding(
          "BLK_ENGINE_WARNING",
          SEVERITIES.INFO,
          VALIDATION_CATEGORIES.BLOCK,
          String(warning),
          { path, sectionOrder, blockOrder, blockType }
        )
      );
    }
  }

  // Block order consistency
  return findings;
}

/**
 * @param {object} structuredDocument
 * @returns {Array<object>}
 */
function validateBlocks(structuredDocument) {
  const findings = [];
  const sections = (structuredDocument && structuredDocument.sections) || [];

  for (const section of sections) {
    const blocks = section.blocks || [];
    for (let i = 0; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (block.order != null && block.order !== i) {
        findings.push(
          createFinding(
            "BLK_ORDER_INDEX",
            SEVERITIES.WARNING,
            VALIDATION_CATEGORIES.ORDERING,
            `Block order property (${block.order}) does not match array index (${i}).`,
            {
              path: `sections[${section.order}].blocks[${i}]`,
              sectionOrder: section.order,
              blockOrder: block.order
            }
          )
        );
      }
      validateOneBlock(block, section, findings);
    }
  }

  return findings;
}

module.exports = {
  validateBlocks
};
