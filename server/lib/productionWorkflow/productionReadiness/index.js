"use strict";

const types = require("./readinessTypes");
const manifest = require("./readinessManifest");
const validation = require("./validation");
const observability = require("./observability");
const service = require("./readinessService");

module.exports = {
  ...types,
  EXPECTED_STAGE_ORDER: manifest.EXPECTED_STAGE_ORDER,
  READINESS_STAGE_NAMES: manifest.STAGE_NAMES,
  EXPECTED_COMPONENT_VERSIONS: manifest.EXPECTED_VERSIONS,
  buildProductionReadinessManifest: manifest.buildProductionReadinessManifest,
  validateProductionManifest: validation.validateProductionManifest,
  buildWorkflowDiagnostics: observability.buildWorkflowDiagnostics,
  buildObservabilitySummary: observability.buildObservabilitySummary,
  evaluateProductionReadiness: service.evaluateProductionReadiness
};
