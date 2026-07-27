"use strict";

/**
 * Phase AI-2 — Government Website Intelligence & Event Classification.
 *
 * Public facade. This layer is advisory and additive: it classifies official
 * government website updates into normalized events before they reach the
 * existing Production Workflow, without changing monitoring, scheduling,
 * generation, publishing or deployment behaviour.
 */

const types = require("./types");
const textUtils = require("./textUtils");
const contentAnalysis = require("./contentAnalysis");
const headingIntelligence = require("./headingIntelligence");
const eventSignals = require("./eventSignals");
const eventDetection = require("./eventDetection");
const eventClassification = require("./eventClassification");
const departmentDetection = require("./departmentDetection");
const referenceIntelligence = require("./referenceIntelligence");
const keywordIntelligence = require("./keywordIntelligence");
const priorityEngine = require("./priorityEngine");
const confidenceEngine = require("./confidenceEngine");
const fingerprint = require("./fingerprint");
const validation = require("./validation");
const normalizedEvent = require("./normalizedEvent");
const pipeline = require("./pipeline");

module.exports = {
  ...types,
  ...textUtils,
  ...contentAnalysis,
  ...headingIntelligence,
  ...eventSignals,
  ...eventDetection,
  ...eventClassification,
  ...departmentDetection,
  ...referenceIntelligence,
  ...keywordIntelligence,
  ...priorityEngine,
  ...confidenceEngine,
  ...fingerprint,
  ...validation,
  ...normalizedEvent,
  ...pipeline
};
