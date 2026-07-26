"use strict";

const {
  NORMALIZED_RESPONSE_FORMAT_ID,
  CONTRACT_VERSION
} = require("../aiDraftGeneration/generationTypes");
const { finding } = require("./governanceTypes");

const ROOT_FIELDS = Object.freeze([
  "formatId",
  "version",
  "document",
  "metadata",
  "sections",
  "sectionCount",
  "blockCount",
  "warnings",
  "notes",
  "confidence",
  "unknownFields",
  "extensions"
]);

function compatibleVersion(version) {
  if (version == null) return false;
  return String(version).split(".")[0] === CONTRACT_VERSION.split(".")[0];
}

function validateSchema(response) {
  const findings = [];
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return {
      valid: false,
      compatible: false,
      findings: [
        finding("schema.invalid_root", "error", "schema", "AI response must be an object.", {
          path: "$"
        })
      ],
      unknownFields: []
    };
  }

  if (response.formatId !== NORMALIZED_RESPONSE_FORMAT_ID) {
    findings.push(
      finding(
        "schema.format_mismatch",
        "error",
        "schema",
        `Expected normalized response format ${NORMALIZED_RESPONSE_FORMAT_ID}.`,
        { actual: response.formatId == null ? null : response.formatId, path: "formatId" }
      )
    );
  }
  if (!compatibleVersion(response.version)) {
    findings.push(
      finding(
        "schema.version_incompatible",
        "error",
        "schema",
        `Response version is not compatible with contract ${CONTRACT_VERSION}.`,
        { actual: response.version == null ? null : response.version, path: "version" }
      )
    );
  }
  if (
    !response.document ||
    typeof response.document !== "object" ||
    Array.isArray(response.document)
  ) {
    findings.push(
      finding("schema.document_required", "error", "schema", "A document object is required.", {
        path: "document"
      })
    );
  }
  if (!Array.isArray(response.sections)) {
    findings.push(
      finding("schema.sections_required", "error", "schema", "Sections must be an array.", {
        path: "sections"
      })
    );
  }
  if (
    response.metadata !== undefined &&
    response.metadata !== null &&
    (typeof response.metadata !== "object" || Array.isArray(response.metadata))
  ) {
    findings.push(
      finding("schema.metadata_type", "error", "schema", "Metadata must be an object or null.", {
        path: "metadata"
      })
    );
  }
  for (const field of ["warnings", "notes", "unknownFields"]) {
    if (
      response[field] !== undefined &&
      response[field] !== null &&
      !Array.isArray(response[field])
    ) {
      findings.push(
        finding(`schema.${field}_type`, "warning", "schema", `${field} must be an array.`, {
          path: field
        })
      );
    }
  }
  if (
    response.confidence !== undefined &&
    response.confidence !== null &&
    !Number.isFinite(Number(response.confidence))
  ) {
    findings.push(
      finding(
        "schema.confidence_type",
        "warning",
        "schema",
        "Confidence must be numeric or null.",
        { path: "confidence" }
      )
    );
  }

  if (Array.isArray(response.sections)) {
    response.sections.forEach((section, sectionIndex) => {
      const path = `sections[${sectionIndex}]`;
      if (!section || typeof section !== "object" || Array.isArray(section)) {
        findings.push(
          finding("schema.section_type", "error", "schema", "Each section must be an object.", {
            path
          })
        );
        return;
      }
      if (typeof section.sectionType !== "string") {
        findings.push(
          finding("schema.section_type_field", "error", "schema", "sectionType must be a string.", {
            path: `${path}.sectionType`
          })
        );
      }
      if (!Array.isArray(section.blocks)) {
        findings.push(
          finding("schema.blocks_required", "error", "schema", "Section blocks must be an array.", {
            path: `${path}.blocks`
          })
        );
        return;
      }
      section.blocks.forEach((block, blockIndex) => {
        const blockPath = `${path}.blocks[${blockIndex}]`;
        if (!block || typeof block !== "object" || Array.isArray(block)) {
          findings.push(
            finding("schema.block_type", "error", "schema", "Each block must be an object.", {
              path: blockPath
            })
          );
          return;
        }
        if (typeof block.blockType !== "string") {
          findings.push(
            finding("schema.block_type_field", "error", "schema", "blockType must be a string.", {
              path: `${blockPath}.blockType`
            })
          );
        }
        if (typeof block.originalContent !== "string") {
          findings.push(
            finding(
              "schema.block_content_type",
              "error",
              "schema",
              "originalContent must be a string.",
              { path: `${blockPath}.originalContent` }
            )
          );
        }
      });
    });
  }

  const unknownFields = Object.keys(response)
    .filter((key) => !ROOT_FIELDS.includes(key))
    .sort();
  if (unknownFields.length) {
    findings.push(
      finding(
        "schema.unknown_fields",
        "info",
        "schema",
        "Unknown fields were retained and did not fail validation.",
        { fields: unknownFields, path: "$" }
      )
    );
  }

  return {
    valid: !findings.some((item) => item.severity === "error"),
    compatible: compatibleVersion(response.version),
    findings,
    unknownFields
  };
}

module.exports = { ROOT_FIELDS, compatibleVersion, validateSchema };
