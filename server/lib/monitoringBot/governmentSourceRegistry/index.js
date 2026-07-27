'use strict';

/**
 * Package MB-1 — Product-side Government Source Registry facade.
 *
 * Thin composition layer over the Government Monitoring Bot MB-1 framework.
 * Reuses Program 5 governance identities without duplicating logic.
 *
 * Configuration and diagnostics only.
 * No monitoring. No HTTP. No routes. No scheduling. No scraping.
 */

const path = require('path');

const frameworkPath = path.resolve(
  __dirname,
  '../../project/monitoringBot/packageMB1GovernmentSourceRegistryFramework.js'
);

const framework = require(frameworkPath);

/**
 * Evaluate product-side government source registry framework (advisory only).
 * Never monitors, fetches, scrapes, or schedules.
 *
 * @param {object} [input]
 */
function evaluateProductGovernmentSourceRegistry(input = {}) {
  const result = framework.evaluateGovernmentSourceRegistryFramework(input);

  return framework.deepFreeze({
    ...result,
    productReuse: {
      pipelineHealth: true,
      monitoringReviewIntegration: true,
      adminDashboard: true,
      publishReadinessAuthorization: true,
      programs1to5Complete: true,
    },
  });
}

module.exports = {
  PACKAGE_ID: framework.PACKAGE_ID,
  PACKAGE_CODE: framework.PACKAGE_CODE,
  PROGRAM_ID: framework.PROGRAM_ID,
  SOURCE_CATEGORIES: framework.SOURCE_CATEGORIES,
  CONTENT_TYPES: framework.CONTENT_TYPES,
  MONITORING_PRIORITIES: framework.MONITORING_PRIORITIES,
  ROBOTS_POLICIES: framework.ROBOTS_POLICIES,
  SOURCE_HEALTH: framework.SOURCE_HEALTH,
  DIAGNOSTIC_CODES: framework.DIAGNOSTIC_CODES,
  DIAGNOSTIC_SEVERITY: framework.DIAGNOSTIC_SEVERITY,
  EXTENSION_POINTS: framework.EXTENSION_POINTS,
  createGovernmentSourceRegistry: framework.createGovernmentSourceRegistry,
  createMonitoringConfigurationMap: framework.createMonitoringConfigurationMap,
  createCrawlPolicy: framework.createCrawlPolicy,
  createCrawlPolicyMap: framework.createCrawlPolicyMap,
  createParserRegistry: framework.createParserRegistry,
  createSourceHealthMetadata: framework.createSourceHealthMetadata,
  createSourceHealthMetadataMap: framework.createSourceHealthMetadataMap,
  validateGovernmentSourceRegistry: framework.validateGovernmentSourceRegistry,
  generateRegistryDiagnostics: framework.generateRegistryDiagnostics,
  generateOperatorRegistryDashboard: framework.generateOperatorRegistryDashboard,
  evaluateGovernmentSourceRegistryFramework:
    framework.evaluateGovernmentSourceRegistryFramework,
  evaluateProductGovernmentSourceRegistry,
  getGovernmentSourceRegistryFramework:
    framework.getGovernmentSourceRegistryFramework,
  getGovernmentSourceRegistryFrameworkIdentity:
    framework.getGovernmentSourceRegistryFrameworkIdentity,
};
