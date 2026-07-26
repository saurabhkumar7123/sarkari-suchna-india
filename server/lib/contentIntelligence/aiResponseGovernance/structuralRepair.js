"use strict";

const { deepClone, normalizeWhitespace } = require("../aiDraftGeneration/responseNormalizer");

function trace(code, path, before, after) {
  return { code, path, before: deepClone(before), after: deepClone(after) };
}

function cleanText(value, trim = false) {
  if (typeof value !== "string") return value;
  const cleaned = normalizeWhitespace(value);
  return trim ? cleaned.trim() : cleaned;
}

function repairText(target, key, path, repairs, trim = false) {
  if (typeof target[key] !== "string") return;
  const before = target[key];
  const after = cleanText(before, trim);
  if (before !== after) {
    target[key] = after;
    repairs.push(trace("repair.whitespace", `${path}.${key}`, before, after));
  }
}

function normalizeList(target, key, repairs) {
  const before = target[key];
  if (before == null) {
    target[key] = [];
    repairs.push(trace("repair.optional_array_default", key, before, []));
    return;
  }
  if (!Array.isArray(before)) return;
  const after = before
    .filter((item) => item != null)
    .map((item) => (typeof item === "string" ? cleanText(item, true) : item))
    .filter((item) => item !== "");
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    target[key] = after;
    repairs.push(trace("repair.array_normalized", key, before, after));
  }
}

function normalizeOrdered(items, path, repairs, childRepair) {
  if (!Array.isArray(items)) return items;
  const decorated = items.map((item, index) => ({
    item,
    index,
    order: item && Number.isFinite(Number(item.order)) ? Number(item.order) : index
  }));
  decorated.sort((a, b) => a.order - b.order || a.index - b.index);
  const after = decorated.map(({ item }, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const copy = item;
    if (copy.order !== index) {
      repairs.push(trace("repair.order_index", `${path}[${index}].order`, copy.order, index));
      copy.order = index;
    }
    childRepair(copy, `${path}[${index}]`, repairs);
    return copy;
  });
  if (decorated.some((entry, index) => entry.index !== index)) {
    repairs.push(
      trace(
        "repair.ordering",
        path,
        items.map((item) => item && item.order),
        after.map((item) => item && item.order)
      )
    );
  }
  return after;
}

function repairBlock(block, path, repairs) {
  repairText(block, "originalContent", path, repairs, false);
}

function repairSection(section, path, repairs) {
  for (const key of ["title", "generatorTitle", "normalizedTitle", "originalTitle"]) {
    repairText(section, key, path, repairs, true);
  }
  if (section.blocks == null) {
    section.blocks = [];
    repairs.push(trace("repair.optional_array_default", `${path}.blocks`, null, []));
  } else if (Array.isArray(section.blocks)) {
    section.blocks = normalizeOrdered(section.blocks, `${path}.blocks`, repairs, repairBlock);
  }
  if (Array.isArray(section.blocks)) section.blockCount = section.blocks.length;
}

function repairStructure(response) {
  const governedDraft = deepClone(response && typeof response === "object" ? response : {});
  const repairs = [];

  if (governedDraft.metadata === undefined) {
    governedDraft.metadata = null;
    repairs.push(trace("repair.optional_object_default", "metadata", undefined, null));
  }
  for (const key of ["warnings", "notes", "unknownFields"])
    normalizeList(governedDraft, key, repairs);
  if (governedDraft.extensions === undefined) {
    governedDraft.extensions = {};
    repairs.push(trace("repair.optional_object_default", "extensions", undefined, {}));
  }

  if (governedDraft.document && typeof governedDraft.document === "object") {
    for (const key of [
      "documentType",
      "documentTypeLabel",
      "language",
      "title",
      "pageStatusHint"
    ]) {
      repairText(governedDraft.document, key, "document", repairs, true);
    }
  }
  if (Array.isArray(governedDraft.sections)) {
    governedDraft.sections = normalizeOrdered(
      governedDraft.sections,
      "sections",
      repairs,
      repairSection
    );
    governedDraft.sectionCount = governedDraft.sections.length;
    governedDraft.blockCount = governedDraft.sections.reduce(
      (total, section) =>
        total + (Array.isArray(section && section.blocks) ? section.blocks.length : 0),
      0
    );
  }

  const beforeConfidence = governedDraft.confidence;
  let confidence = beforeConfidence;
  if (confidence === undefined || confidence === "") confidence = null;
  else if (confidence !== null) {
    confidence = Number(confidence);
    if (!Number.isFinite(confidence)) confidence = null;
    else if (confidence > 1 && confidence <= 100) confidence /= 100;
    else confidence = Math.max(0, Math.min(1, confidence));
  }
  if (!Object.is(beforeConfidence, confidence)) {
    governedDraft.confidence = confidence;
    repairs.push(trace("repair.confidence", "confidence", beforeConfidence, confidence));
  }

  return { governedDraft, repairsApplied: repairs };
}

module.exports = { repairStructure, cleanText };
