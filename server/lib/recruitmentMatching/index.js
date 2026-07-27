"use strict";

/**
 * Phase AI-3 — Recruitment Matching & Recommendation Engine.
 *
 * Public facade. This layer decides whether a normalized event belongs to an
 * existing recruitment or represents a new one, and says so as a recommendation
 * only. It does not change monitoring, the Production Workflow, the Generator,
 * publishing, or any database schema, and it never sets `AUTO_PUBLISH`.
 */

const types = require("./types");
const matchingUtils = require("./matchingUtils");
const recruitmentRecord = require("./recruitmentRecord");
const candidateSearch = require("./candidateSearch");
const similarityEngine = require("./similarityEngine");
const updateClassification = require("./updateClassification");
const confidenceEngine = require("./confidenceEngine");
const validation = require("./validation");
const recommendationEngine = require("./recommendationEngine");
const recommendation = require("./recommendation");
const pipeline = require("./pipeline");

module.exports = {
  ...types,
  ...matchingUtils,
  ...recruitmentRecord,
  ...candidateSearch,
  ...similarityEngine,
  ...updateClassification,
  ...confidenceEngine,
  ...validation,
  ...recommendationEngine,
  ...recommendation,
  ...pipeline
};
