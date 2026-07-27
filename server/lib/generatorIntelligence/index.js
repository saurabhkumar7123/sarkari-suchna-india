"use strict";

/**
 * Phase AI-1 — Generator Intelligence public facade.
 * Quality upgrade for PDF → structured → Generator publisher text.
 * Does NOT change publishing, monitoring, or production workflow.
 */

const types = require("./types");
const textNormalization = require("./textNormalization");
const sectionDetection = require("./sectionDetection");
const smartTableDetection = require("./smartTableDetection");
const linkClassification = require("./linkClassification");
const fieldValidation = require("./fieldValidation");
const structuredOutput = require("./structuredOutput");
const publisherCompile = require("./publisherCompile");
const pipeline = require("./pipeline");

module.exports = {
  ...types,
  ...textNormalization,
  ...sectionDetection,
  ...smartTableDetection,
  ...linkClassification,
  ...fieldValidation,
  ...structuredOutput,
  ...publisherCompile,
  ...pipeline
};
