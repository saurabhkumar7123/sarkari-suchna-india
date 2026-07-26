"use strict";

const { BLOCK_TYPES } = require("./pdfExtractionTypes");

function blockReference(block) {
  return {
    type: "block",
    blockId: block.id,
    blockType: block.type,
    order: block.order,
    pageNumber: block.pageNumber == null ? null : block.pageNumber,
    resources: []
  };
}

/**
 * Document → Pages → Sections → Blocks → Resources
 * Also exposes document-level sections/blocks for Stage 3B parity.
 */
function buildStructuralTree(blocks, resources, pageCount) {
  const root = {
    type: "document",
    pages: [],
    blocks: [],
    resources: [],
    sections: []
  };

  const pagesByNumber = new Map();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const pageNode = {
      type: "page",
      id: `page-${pageNumber}`,
      pageNumber,
      blocks: [],
      resources: [],
      sections: []
    };
    pagesByNumber.set(pageNumber, pageNode);
    root.pages.push(pageNode);
  }

  const documentStack = [];
  const pageStacks = new Map();
  const blockLocations = new Map();

  for (const block of blocks) {
    if (block.type === BLOCK_TYPES.HEADER || block.type === BLOCK_TYPES.FOOTER) {
      const reference = blockReference(block);
      const pageNode = pagesByNumber.get(block.pageNumber);
      if (pageNode) {
        pageNode.blocks.push(reference);
        blockLocations.set(block.id, { documentRef: null, pageRef: reference });
      } else {
        root.blocks.push(reference);
        blockLocations.set(block.id, { documentRef: reference, pageRef: null });
      }
      continue;
    }

    const isHeading = block.type === BLOCK_TYPES.HEADING || block.type === BLOCK_TYPES.SECTION_TITLE;
    if (isHeading) {
      while (
        documentStack.length &&
        documentStack[documentStack.length - 1].actualLevel >= (block.level || 3)
      ) {
        documentStack.pop();
      }
      const parent = documentStack.length ? documentStack[documentStack.length - 1] : null;
      const normalizedLevel = parent ? parent.normalizedLevel + 1 : 1;
      block.normalizedLevel = normalizedLevel;
      const section = {
        type: normalizedLevel === 1 ? "section" : "subsection",
        id: `section-${block.id.slice("block-".length)}`,
        headingBlockId: block.id,
        actualHeadingLevel: block.level || 3,
        normalizedHeadingLevel: normalizedLevel,
        pageNumber: block.pageNumber == null ? null : block.pageNumber,
        blocks: [],
        subsections: []
      };
      if (parent) parent.section.subsections.push(section);
      else root.sections.push(section);
      documentStack.push({
        actualLevel: block.level || 3,
        normalizedLevel,
        section
      });

      const pageNode = pagesByNumber.get(block.pageNumber);
      if (pageNode) {
        if (!pageStacks.has(pageNode.pageNumber)) pageStacks.set(pageNode.pageNumber, []);
        const pageStack = pageStacks.get(pageNode.pageNumber);
        while (
          pageStack.length &&
          pageStack[pageStack.length - 1].actualLevel >= (block.level || 3)
        ) {
          pageStack.pop();
        }
        const pageParent = pageStack.length ? pageStack[pageStack.length - 1] : null;
        const pageSection = {
          type: section.type,
          id: `page-${pageNode.pageNumber}-${section.id}`,
          headingBlockId: block.id,
          actualHeadingLevel: section.actualHeadingLevel,
          normalizedHeadingLevel: pageParent ? pageParent.normalizedLevel + 1 : 1,
          blocks: [],
          subsections: []
        };
        if (pageParent) pageParent.section.subsections.push(pageSection);
        else pageNode.sections.push(pageSection);
        pageStack.push({
          actualLevel: block.level || 3,
          normalizedLevel: pageSection.normalizedHeadingLevel,
          section: pageSection
        });
      }
    }

    const reference = blockReference(block);
    const documentOwner = documentStack.length
      ? documentStack[documentStack.length - 1].section
      : root;
    documentOwner.blocks.push(reference);

    const pageNode = pagesByNumber.get(block.pageNumber);
    let pageRef = null;
    if (pageNode) {
      const pageStack = pageStacks.get(pageNode.pageNumber) || [];
      const pageOwner = pageStack.length ? pageStack[pageStack.length - 1].section : pageNode;
      pageRef = blockReference(block);
      pageOwner.blocks.push(pageRef);
    }

    blockLocations.set(block.id, { documentRef: reference, pageRef });
  }

  const blocksByOrder = blocks.slice().sort((a, b) => a.order - b.order);
  for (const resource of resources) {
    let owner = null;
    for (const block of blocksByOrder) {
      if (resource.pageNumber != null && block.pageNumber != null && block.pageNumber !== resource.pageNumber) {
        continue;
      }
      if (block.order > resource.order && resource.pageNumber == null) break;
      if (block.order > resource.order && resource.pageNumber != null && block.pageNumber === resource.pageNumber) {
        break;
      }
      owner = block;
    }

    if (owner) {
      const location = blockLocations.get(owner.id);
      if (location?.documentRef) location.documentRef.resources.push(resource.id);
      if (location?.pageRef) location.pageRef.resources.push(resource.id);
    } else if (resource.pageNumber != null && pagesByNumber.has(resource.pageNumber)) {
      pagesByNumber.get(resource.pageNumber).resources.push(resource.id);
    } else {
      root.resources.push(resource.id);
    }
  }

  return root;
}

module.exports = { buildStructuralTree };
