"use strict";

/**
 * Phase AI-4 — Editorial Intelligence & Draft Quality Engine.
 *
 * Public facade. Analyses AI-generated recruitment drafts before Editorial
 * Review. Advisory only: does not publish, does not modify Generator UI,
 * Production Workflow, Monitoring, or AUTO_PUBLISH, and never applies draft
 * changes automatically.
 */

const types = require("./types");
const draftUtils = require("./draftUtils");
const draftModel = require("./draftModel");
const completeness = require("./completeness");
const crossSectionValidation = require("./crossSectionValidation");
const missingInformation = require("./missingInformation");
const languageQuality = require("./languageQuality");
const linkValidation = require("./linkValidation");
const sectionOrdering = require("./sectionOrdering");
const suggestions = require("./suggestions");
const qualityScores = require("./qualityScores");
const summary = require("./summary");
const report = require("./report");
const pipeline = require("./pipeline");

module.exports = {
  ...types,
  ...draftUtils,
  ...draftModel,
  ...completeness,
  ...crossSectionValidation,
  ...missingInformation,
  ...languageQuality,
  ...linkValidation,
  ...sectionOrdering,
  ...suggestions,
  ...qualityScores,
  ...summary,
  ...report,
  ...pipeline
};
