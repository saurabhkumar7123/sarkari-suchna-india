"use strict";

const { BLOCK_TYPES } = require("./htmlExtractionTypes");

function blockReference(block) {
  return {
    type: "block",
    blockId: block.id,
    blockType: block.type,
    order: block.order,
    resources: []
  };
}

function buildStructuralTree(blocks, resources) {
  const root = {
    type: "document",
    blocks: [],
    resources: [],
    sections: []
  };
  const stack = [];
  const blockLocations = new Map();
  let current = root;

  for (const block of blocks) {
    if (block.type === BLOCK_TYPES.HEADING) {
      while (stack.length && stack[stack.length - 1].actualLevel >= block.level) stack.pop();
      const parent = stack.length ? stack[stack.length - 1] : null;
      const normalizedLevel = parent ? parent.normalizedLevel + 1 : 1;
      block.normalizedLevel = normalizedLevel;
      const section = {
        type: normalizedLevel === 1 ? "section" : "subsection",
        id: `section-${block.id.slice("block-".length)}`,
        headingBlockId: block.id,
        actualHeadingLevel: block.level,
        normalizedHeadingLevel: normalizedLevel,
        blocks: [],
        subsections: []
      };
      if (parent) parent.section.subsections.push(section);
      else root.sections.push(section);
      stack.push({ actualLevel: block.level, normalizedLevel, section });
      current = section;
    }

    const reference = blockReference(block);
    current.blocks.push(reference);
    blockLocations.set(block.id, reference);
  }

  const blocksByOrder = blocks.slice().sort((a, b) => a.order - b.order);
  for (const resource of resources) {
    let owner = null;
    for (const block of blocksByOrder) {
      if (block.order > resource.order) break;
      owner = block;
    }
    if (owner) blockLocations.get(owner.id).resources.push(resource.id);
    else root.resources.push(resource.id);
  }

  return root;
}

module.exports = { buildStructuralTree };
