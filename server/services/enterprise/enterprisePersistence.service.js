"use strict";

const recruitmentEnterpriseRepository = require("../../repositories/enterprise/recruitmentEnterprise.repository");
const draftEnterpriseRepository = require("../../repositories/enterprise/draftEnterprise.repository");
const workflowEnterpriseRepository = require("../../repositories/enterprise/workflowEnterprise.repository");
const reviewQueueEnterpriseRepository = require("../../repositories/enterprise/reviewQueueEnterprise.repository");
const auditEnterpriseRepository = require("../../repositories/enterprise/auditEnterprise.repository");
const metricsEnterpriseRepository = require("../../repositories/enterprise/metricsEnterprise.repository");
const versionHistoryService = require("../../lib/enterprise/versionHistory/VersionHistoryService");
const softDeleteService = require("../../lib/enterprise/softDelete/SoftDeleteService");
const universalSearchService = require("../../lib/enterprise/search/UniversalSearchService");
const notificationGateway = require("../../lib/enterprise/notificationGateway");
const rbacService = require("../../lib/enterprise/rbac/RbacService");
const { getAutomationFlags, isAutomationDormant } = require("../../config/automationFlags");

function createEnterprisePersistenceService(deps = {}) {
  return {
    recruitment: deps.recruitment || recruitmentEnterpriseRepository,
    draft: deps.draft || draftEnterpriseRepository,
    workflow: deps.workflow || workflowEnterpriseRepository,
    reviewQueue: deps.reviewQueue || reviewQueueEnterpriseRepository,
    audit: deps.audit || auditEnterpriseRepository,
    metrics: deps.metrics || metricsEnterpriseRepository,
    versionHistory: deps.versionHistory || versionHistoryService,
    softDelete: deps.softDelete || softDeleteService,
    search: deps.search || universalSearchService,
    notificationGateway: deps.notificationGateway || notificationGateway,
    rbac: deps.rbac || rbacService
  };
}

const defaultService = createEnterprisePersistenceService();

async function getPlatformSnapshot() {
  const flags = getAutomationFlags();
  const { evaluateActivationReadiness } = require("../../lib/recruitment/productionRuntime/activationReadiness");
  const readiness = await evaluateActivationReadiness();
  return {
    package: "AMP-4B",
    automationDormant: isAutomationDormant(),
    productionRuntimeReady: readiness.ready,
    activationDecision: readiness.decision,
    flags,
    repositories: {
      recruitment: await recruitmentEnterpriseRepository.isReady(),
      draft: await draftEnterpriseRepository.isReady(),
      workflow: await workflowEnterpriseRepository.isReady(),
      reviewQueue: await reviewQueueEnterpriseRepository.isReady(),
      audit: await auditEnterpriseRepository.isReady(),
      metrics: await metricsEnterpriseRepository.isReady()
    },
    notificationGateway: notificationGateway.getChannelStatus(),
    rbac: {
      roles: Object.values(require("../../lib/enterprise/rbac/roles").ROLES)
    },
    readiness
  };
}

module.exports = {
  createEnterprisePersistenceService,
  defaultService,
  getPlatformSnapshot
};
