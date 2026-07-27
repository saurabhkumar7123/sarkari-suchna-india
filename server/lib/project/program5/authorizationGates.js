'use strict';

/**
 * PROGRAM 5 — Package 5F
 * Authorization Gates (Reusable / Advisory)
 *
 * Reusable authorization gates for controlled publish readiness assessment.
 * Each gate returns PASS / WARNING / BLOCKED.
 * No automatic approval. Evaluation only.
 *
 * Reuses observations from:
 *   Pipeline Health, Controlled Lifecycle Engine, Draft Preparation,
 *   Candidate Resolution, Editorial Review, SEO Diagnostics,
 *   Shared Preview, Monitoring Review Integration.
 */

const {
  deepFreeze,
  REUSED_MODULE_IDS,
} = require('./publishReadinessContract');

const AUTHORIZATION_GATES_VERSION = '5F.1.0.0';

const GATE_RESULT = Object.freeze({
  PASS: 'PASS',
  WARNING: 'WARNING',
  BLOCKED: 'BLOCKED',
});

const AUTHORIZATION_GATE_IDS = Object.freeze({
  PIPELINE_HEALTH: 'PIPELINE_HEALTH',
  LIFECYCLE_READINESS: 'LIFECYCLE_READINESS',
  DRAFT_READINESS: 'DRAFT_READINESS',
  CANDIDATE_RESOLUTION: 'CANDIDATE_RESOLUTION',
  EDITORIAL_READINESS: 'EDITORIAL_READINESS',
  SEO_READINESS: 'SEO_READINESS',
  CONFIGURATION_INTEGRITY: 'CONFIGURATION_INTEGRITY',
  REQUIRED_HUMAN_APPROVALS: 'REQUIRED_HUMAN_APPROVALS',
});

/**
 * Default gate catalog — configuration-driven and reusable.
 */
const DEFAULT_AUTHORIZATION_GATE_CATALOG = deepFreeze([
  {
    gateId: AUTHORIZATION_GATE_IDS.PIPELINE_HEALTH,
    name: 'Pipeline Health',
    summary: 'Pipeline stages must be healthy enough for controlled assessment.',
    reusedModules: [REUSED_MODULE_IDS.PIPELINE_HEALTH],
  },
  {
    gateId: AUTHORIZATION_GATE_IDS.LIFECYCLE_READINESS,
    name: 'Lifecycle Readiness',
    summary: 'Lifecycle must indicate advisory publish-ready progression.',
    reusedModules: [REUSED_MODULE_IDS.CONTROLLED_LIFECYCLE_ENGINE],
  },
  {
    gateId: AUTHORIZATION_GATE_IDS.DRAFT_READINESS,
    name: 'Draft Readiness',
    summary: 'Prepared draft must satisfy advisory completeness gates.',
    reusedModules: [REUSED_MODULE_IDS.DRAFT_PREPARATION],
  },
  {
    gateId: AUTHORIZATION_GATE_IDS.CANDIDATE_RESOLUTION,
    name: 'Candidate Resolution',
    summary: 'Candidate resolution diagnostics must not block assessment.',
    reusedModules: [REUSED_MODULE_IDS.CANDIDATE_RESOLUTION],
  },
  {
    gateId: AUTHORIZATION_GATE_IDS.EDITORIAL_READINESS,
    name: 'Editorial Readiness',
    summary: 'Editorial review checklist and approvals must be satisfied.',
    reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
  },
  {
    gateId: AUTHORIZATION_GATE_IDS.SEO_READINESS,
    name: 'SEO Readiness',
    summary: 'SEO diagnostics must indicate advisory readiness.',
    reusedModules: [REUSED_MODULE_IDS.SEO_DIAGNOSTICS],
  },
  {
    gateId: AUTHORIZATION_GATE_IDS.CONFIGURATION_INTEGRITY,
    name: 'Configuration Integrity',
    summary: 'Program 5 configuration and prior package identities must be intact.',
    reusedModules: [
      REUSED_MODULE_IDS.PIPELINE_HEALTH,
      REUSED_MODULE_IDS.MONITORING_REVIEW_INTEGRATION,
      REUSED_MODULE_IDS.CONTROLLED_LIFECYCLE_ENGINE,
      REUSED_MODULE_IDS.DRAFT_PREPARATION,
      REUSED_MODULE_IDS.CANDIDATE_RESOLUTION,
    ],
  },
  {
    gateId: AUTHORIZATION_GATE_IDS.REQUIRED_HUMAN_APPROVALS,
    name: 'Required Human Approvals',
    summary: 'Required human approvals must be recorded. No automatic approval.',
    reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
  },
]);

function normalizeGateResult(value) {
  if (typeof value !== 'string') return GATE_RESULT.BLOCKED;
  const upper = value.trim().toUpperCase();
  if (upper === GATE_RESULT.PASS) return GATE_RESULT.PASS;
  if (upper === GATE_RESULT.WARNING) return GATE_RESULT.WARNING;
  return GATE_RESULT.BLOCKED;
}

function createGateResult(gateId, result, options = {}) {
  return deepFreeze({
    gateId,
    result: normalizeGateResult(result),
    name: typeof options.name === 'string' ? options.name : gateId,
    summary: typeof options.summary === 'string' ? options.summary : '',
    message: typeof options.message === 'string' ? options.message : '',
    automaticApproval: false,
    advisoryOnly: true,
    reusedModules: Array.isArray(options.reusedModules)
      ? options.reusedModules.map(String)
      : [],
    details:
      options.details && typeof options.details === 'object'
        ? options.details
        : {},
  });
}

/**
 * Create a reusable authorization gate registry.
 * @param {object} [options]
 * @param {object[]} [options.gates]
 */
function createAuthorizationGateRegistry(options = {}) {
  const gates =
    Array.isArray(options.gates) && options.gates.length
      ? options.gates.map((g) => ({
          gateId: String(g.gateId),
          name: typeof g.name === 'string' ? g.name : String(g.gateId),
          summary: typeof g.summary === 'string' ? g.summary : '',
          reusedModules: Array.isArray(g.reusedModules)
            ? g.reusedModules.map(String)
            : [],
        }))
      : DEFAULT_AUTHORIZATION_GATE_CATALOG.map((g) => ({
          gateId: g.gateId,
          name: g.name,
          summary: g.summary,
          reusedModules: g.reusedModules.slice(),
        }));

  const byId = {};
  for (let i = 0; i < gates.length; i += 1) {
    byId[gates[i].gateId] = gates[i];
  }

  return deepFreeze({
    registryId: 'AUTHORIZATION_GATE_REGISTRY',
    version: AUTHORIZATION_GATES_VERSION,
    configurationDriven: true,
    reusable: true,
    automaticApproval: false,
    gateCount: gates.length,
    gateIds: gates.map((g) => g.gateId),
    gates,
    byId,
    resultValues: Object.values(GATE_RESULT),
  });
}

function getDefaultAuthorizationGateRegistry() {
  return createAuthorizationGateRegistry();
}

function evaluatePipelineHealthGate(observations = {}) {
  const status =
    typeof observations.pipelineOverallStatus === 'string'
      ? observations.pipelineOverallStatus.toUpperCase()
      : observations.pipelineHealthy === true
        ? 'HEALTHY'
        : observations.pipelineHealthy === false
          ? 'BLOCKED'
          : 'UNKNOWN';

  if (status === 'HEALTHY') {
    return createGateResult(AUTHORIZATION_GATE_IDS.PIPELINE_HEALTH, GATE_RESULT.PASS, {
      name: 'Pipeline Health',
      summary: 'Pipeline stages report healthy advisory status.',
      message: 'Pipeline health gate passed.',
      reusedModules: [REUSED_MODULE_IDS.PIPELINE_HEALTH],
      details: { pipelineOverallStatus: status },
    });
  }
  if (status === 'WARNING' || status === 'DEGRADED') {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.PIPELINE_HEALTH,
      GATE_RESULT.WARNING,
      {
        name: 'Pipeline Health',
        summary: 'Pipeline reports non-blocking advisory warnings.',
        message: `Pipeline health status is ${status}.`,
        reusedModules: [REUSED_MODULE_IDS.PIPELINE_HEALTH],
        details: { pipelineOverallStatus: status },
      }
    );
  }
  return createGateResult(
    AUTHORIZATION_GATE_IDS.PIPELINE_HEALTH,
    GATE_RESULT.BLOCKED,
    {
      name: 'Pipeline Health',
      summary: 'Pipeline health is blocked or unknown.',
      message: `Pipeline health status is ${status}.`,
      reusedModules: [REUSED_MODULE_IDS.PIPELINE_HEALTH],
      details: { pipelineOverallStatus: status },
    }
  );
}

function evaluateLifecycleReadinessGate(observations = {}) {
  const remainingGates = Array.isArray(observations.lifecycleRemainingGates)
    ? observations.lifecycleRemainingGates
    : [];
  const currentState =
    typeof observations.lifecycleCurrentState === 'string'
      ? observations.lifecycleCurrentState.toUpperCase()
      : 'UNKNOWN';
  const ready = Boolean(observations.lifecycleReady);
  const publishReadyHint =
    currentState === 'PUBLISH_READY' ||
    currentState === 'SEO_READY' ||
    ready;

  if (remainingGates.length === 0 && publishReadyHint) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.LIFECYCLE_READINESS,
      GATE_RESULT.PASS,
      {
        name: 'Lifecycle Readiness',
        summary: 'Lifecycle remaining gates are clear for assessment.',
        message: `Lifecycle state ${currentState} is assessment-ready.`,
        reusedModules: [REUSED_MODULE_IDS.CONTROLLED_LIFECYCLE_ENGINE],
        details: { currentState, remainingGates },
      }
    );
  }
  if (remainingGates.length > 0 && remainingGates.length <= 2) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.LIFECYCLE_READINESS,
      GATE_RESULT.WARNING,
      {
        name: 'Lifecycle Readiness',
        summary: 'Lifecycle has remaining non-critical gates.',
        message: `Remaining lifecycle gates: ${remainingGates.join(', ')}`,
        reusedModules: [REUSED_MODULE_IDS.CONTROLLED_LIFECYCLE_ENGINE],
        details: { currentState, remainingGates },
      }
    );
  }
  return createGateResult(
    AUTHORIZATION_GATE_IDS.LIFECYCLE_READINESS,
    GATE_RESULT.BLOCKED,
    {
      name: 'Lifecycle Readiness',
      summary: 'Lifecycle is not ready for controlled publish assessment.',
      message:
        remainingGates.length > 0
          ? `Blocking lifecycle gates: ${remainingGates.join(', ')}`
          : `Lifecycle state ${currentState} is not ready.`,
      reusedModules: [REUSED_MODULE_IDS.CONTROLLED_LIFECYCLE_ENGINE],
      details: { currentState, remainingGates },
    }
  );
}

function evaluateDraftReadinessGate(observations = {}) {
  const ready = Boolean(observations.draftReady);
  const completenessScore = Number(observations.draftCompletenessScore);
  const remainingIssues = Array.isArray(observations.draftRemainingIssues)
    ? observations.draftRemainingIssues
    : [];

  if (ready && remainingIssues.length === 0) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.DRAFT_READINESS,
      GATE_RESULT.PASS,
      {
        name: 'Draft Readiness',
        summary: 'Draft preparation reports advisory readiness.',
        message: 'Draft readiness gate passed.',
        reusedModules: [REUSED_MODULE_IDS.DRAFT_PREPARATION],
        details: { ready, completenessScore, remainingIssues },
      }
    );
  }
  if (ready || (Number.isFinite(completenessScore) && completenessScore >= 0.75)) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.DRAFT_READINESS,
      GATE_RESULT.WARNING,
      {
        name: 'Draft Readiness',
        summary: 'Draft has remaining advisory issues.',
        message:
          remainingIssues.length > 0
            ? `Draft remaining issues: ${remainingIssues.join(', ')}`
            : 'Draft completeness is partial.',
        reusedModules: [REUSED_MODULE_IDS.DRAFT_PREPARATION],
        details: { ready, completenessScore, remainingIssues },
      }
    );
  }
  return createGateResult(
    AUTHORIZATION_GATE_IDS.DRAFT_READINESS,
    GATE_RESULT.BLOCKED,
    {
      name: 'Draft Readiness',
      summary: 'Draft is not ready for controlled assessment.',
      message: 'Draft readiness prerequisites are incomplete.',
      reusedModules: [REUSED_MODULE_IDS.DRAFT_PREPARATION],
      details: { ready, completenessScore, remainingIssues },
    }
  );
}

function evaluateCandidateResolutionGate(observations = {}) {
  const unresolvedCount = Number(observations.resolutionUnresolvedCount) || 0;
  const automaticMerge = Boolean(observations.resolutionAutomaticMerge);
  const advisoryOnly =
    observations.resolutionAdvisoryOnly !== false && !automaticMerge;

  if (!advisoryOnly || automaticMerge) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.CANDIDATE_RESOLUTION,
      GATE_RESULT.BLOCKED,
      {
        name: 'Candidate Resolution',
        summary: 'Candidate resolution must remain advisory-only.',
        message: 'Automatic merge indicators block authorization assessment.',
        reusedModules: [REUSED_MODULE_IDS.CANDIDATE_RESOLUTION],
        details: { unresolvedCount, automaticMerge, advisoryOnly },
      }
    );
  }
  if (unresolvedCount === 0) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.CANDIDATE_RESOLUTION,
      GATE_RESULT.PASS,
      {
        name: 'Candidate Resolution',
        summary: 'No unresolved candidate resolution groups.',
        message: 'Candidate resolution gate passed.',
        reusedModules: [REUSED_MODULE_IDS.CANDIDATE_RESOLUTION],
        details: { unresolvedCount, automaticMerge, advisoryOnly },
      }
    );
  }
  if (unresolvedCount <= 3) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.CANDIDATE_RESOLUTION,
      GATE_RESULT.WARNING,
      {
        name: 'Candidate Resolution',
        summary: 'Unresolved candidate groups require operator review.',
        message: `${unresolvedCount} unresolved resolution group(s).`,
        reusedModules: [REUSED_MODULE_IDS.CANDIDATE_RESOLUTION],
        details: { unresolvedCount, automaticMerge, advisoryOnly },
      }
    );
  }
  return createGateResult(
    AUTHORIZATION_GATE_IDS.CANDIDATE_RESOLUTION,
    GATE_RESULT.BLOCKED,
    {
      name: 'Candidate Resolution',
      summary: 'Too many unresolved candidate groups.',
      message: `${unresolvedCount} unresolved resolution group(s) block readiness.`,
      reusedModules: [REUSED_MODULE_IDS.CANDIDATE_RESOLUTION],
      details: { unresolvedCount, automaticMerge, advisoryOnly },
    }
  );
}

function evaluateEditorialReadinessGate(observations = {}) {
  const editorialReady = Boolean(observations.editorialReady);
  const checklistComplete = Boolean(observations.editorialChecklistComplete);
  const missingChecklist = Array.isArray(observations.editorialMissingChecklist)
    ? observations.editorialMissingChecklist
    : [];

  if (editorialReady && checklistComplete && missingChecklist.length === 0) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.EDITORIAL_READINESS,
      GATE_RESULT.PASS,
      {
        name: 'Editorial Readiness',
        summary: 'Editorial checklist and review status are satisfied.',
        message: 'Editorial readiness gate passed.',
        reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
        details: { editorialReady, checklistComplete, missingChecklist },
      }
    );
  }
  if (editorialReady || missingChecklist.length <= 2) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.EDITORIAL_READINESS,
      GATE_RESULT.WARNING,
      {
        name: 'Editorial Readiness',
        summary: 'Editorial review has remaining checklist items.',
        message:
          missingChecklist.length > 0
            ? `Missing checklist: ${missingChecklist.join(', ')}`
            : 'Editorial readiness is partial.',
        reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
        details: { editorialReady, checklistComplete, missingChecklist },
      }
    );
  }
  return createGateResult(
    AUTHORIZATION_GATE_IDS.EDITORIAL_READINESS,
    GATE_RESULT.BLOCKED,
    {
      name: 'Editorial Readiness',
      summary: 'Editorial readiness is incomplete.',
      message: 'Editorial checklist and review status block assessment.',
      reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
      details: { editorialReady, checklistComplete, missingChecklist },
    }
  );
}

function evaluateSeoReadinessGate(observations = {}) {
  const seoReady = Boolean(observations.seoReady);
  const missingSeo = Array.isArray(observations.seoMissingFields)
    ? observations.seoMissingFields
    : [];
  const seoBlocking = Boolean(observations.seoBlocking);

  if (seoReady && missingSeo.length === 0 && !seoBlocking) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.SEO_READINESS,
      GATE_RESULT.PASS,
      {
        name: 'SEO Readiness',
        summary: 'SEO diagnostics indicate advisory readiness.',
        message: 'SEO readiness gate passed.',
        reusedModules: [REUSED_MODULE_IDS.SEO_DIAGNOSTICS],
        details: { seoReady, missingSeo, seoBlocking },
      }
    );
  }
  if (!seoBlocking && (seoReady || missingSeo.length <= 2)) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.SEO_READINESS,
      GATE_RESULT.WARNING,
      {
        name: 'SEO Readiness',
        summary: 'SEO diagnostics report non-blocking gaps.',
        message:
          missingSeo.length > 0
            ? `Missing SEO fields: ${missingSeo.join(', ')}`
            : 'SEO readiness is partial.',
        reusedModules: [REUSED_MODULE_IDS.SEO_DIAGNOSTICS],
        details: { seoReady, missingSeo, seoBlocking },
      }
    );
  }
  return createGateResult(
    AUTHORIZATION_GATE_IDS.SEO_READINESS,
    GATE_RESULT.BLOCKED,
    {
      name: 'SEO Readiness',
      summary: 'SEO diagnostics block controlled assessment.',
      message: 'SEO readiness prerequisites are incomplete.',
      reusedModules: [REUSED_MODULE_IDS.SEO_DIAGNOSTICS],
      details: { seoReady, missingSeo, seoBlocking },
    }
  );
}

function evaluateConfigurationIntegrityGate(observations = {}) {
  const packagesComplete = Array.isArray(observations.completedPackages)
    ? observations.completedPackages
    : [];
  const required = ['5A', '5B', '5C', '5D', '5E'];
  const missing = required.filter((code) => packagesComplete.indexOf(code) === -1);
  const configValid = observations.configurationValid !== false;
  const automationAuthorized = Boolean(observations.program5AutomationAuthorized);

  if (automationAuthorized) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.CONFIGURATION_INTEGRITY,
      GATE_RESULT.BLOCKED,
      {
        name: 'Configuration Integrity',
        summary: 'Automation authorization must remain denied in Program 5.',
        message: 'program5AutomationAuthorized must be false.',
        reusedModules: [
          REUSED_MODULE_IDS.PIPELINE_HEALTH,
          REUSED_MODULE_IDS.CONTROLLED_LIFECYCLE_ENGINE,
        ],
        details: { packagesComplete, missing, configValid, automationAuthorized },
      }
    );
  }
  if (missing.length === 0 && configValid) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.CONFIGURATION_INTEGRITY,
      GATE_RESULT.PASS,
      {
        name: 'Configuration Integrity',
        summary: 'Prior Program 5 packages and configuration are intact.',
        message: 'Configuration integrity gate passed.',
        reusedModules: [
          REUSED_MODULE_IDS.PIPELINE_HEALTH,
          REUSED_MODULE_IDS.MONITORING_REVIEW_INTEGRATION,
          REUSED_MODULE_IDS.CONTROLLED_LIFECYCLE_ENGINE,
          REUSED_MODULE_IDS.DRAFT_PREPARATION,
          REUSED_MODULE_IDS.CANDIDATE_RESOLUTION,
        ],
        details: { packagesComplete, missing, configValid, automationAuthorized },
      }
    );
  }
  if (missing.length <= 1 && configValid) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.CONFIGURATION_INTEGRITY,
      GATE_RESULT.WARNING,
      {
        name: 'Configuration Integrity',
        summary: 'Minor configuration gaps remain.',
        message: `Missing package completeness markers: ${missing.join(', ')}`,
        reusedModules: [REUSED_MODULE_IDS.PIPELINE_HEALTH],
        details: { packagesComplete, missing, configValid, automationAuthorized },
      }
    );
  }
  return createGateResult(
    AUTHORIZATION_GATE_IDS.CONFIGURATION_INTEGRITY,
    GATE_RESULT.BLOCKED,
    {
      name: 'Configuration Integrity',
      summary: 'Configuration integrity is incomplete.',
      message:
        missing.length > 0
          ? `Missing packages: ${missing.join(', ')}`
          : 'Configuration validation failed.',
      reusedModules: [REUSED_MODULE_IDS.PIPELINE_HEALTH],
      details: { packagesComplete, missing, configValid, automationAuthorized },
    }
  );
}

function evaluateHumanApprovalsGate(observations = {}) {
  const requiredApprovals = Array.isArray(observations.requiredApprovals)
    ? observations.requiredApprovals
    : ['EDITORIAL_APPROVAL', 'PUBLISH_READINESS_REVIEW'];
  const recordedApprovals = Array.isArray(observations.recordedApprovals)
    ? observations.recordedApprovals
    : [];
  const missing = requiredApprovals.filter(
    (id) => recordedApprovals.indexOf(id) === -1
  );
  const autoApproved = Boolean(observations.automaticApproval);

  if (autoApproved) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.REQUIRED_HUMAN_APPROVALS,
      GATE_RESULT.BLOCKED,
      {
        name: 'Required Human Approvals',
        summary: 'Automatic approval is prohibited.',
        message: 'Human approvals cannot be auto-granted.',
        reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
        details: { requiredApprovals, recordedApprovals, missing, autoApproved },
      }
    );
  }
  if (missing.length === 0) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.REQUIRED_HUMAN_APPROVALS,
      GATE_RESULT.PASS,
      {
        name: 'Required Human Approvals',
        summary: 'All required human approvals are recorded.',
        message: 'Human approvals gate passed. No automatic approval.',
        reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
        details: { requiredApprovals, recordedApprovals, missing, autoApproved },
      }
    );
  }
  if (missing.length === 1) {
    return createGateResult(
      AUTHORIZATION_GATE_IDS.REQUIRED_HUMAN_APPROVALS,
      GATE_RESULT.WARNING,
      {
        name: 'Required Human Approvals',
        summary: 'One required human approval is outstanding.',
        message: `Missing approval: ${missing[0]}`,
        reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
        details: { requiredApprovals, recordedApprovals, missing, autoApproved },
      }
    );
  }
  return createGateResult(
    AUTHORIZATION_GATE_IDS.REQUIRED_HUMAN_APPROVALS,
    GATE_RESULT.BLOCKED,
    {
      name: 'Required Human Approvals',
      summary: 'Required human approvals are incomplete.',
      message: `Missing approvals: ${missing.join(', ')}`,
      reusedModules: [REUSED_MODULE_IDS.EDITORIAL_REVIEW],
      details: { requiredApprovals, recordedApprovals, missing, autoApproved },
    }
  );
}

const GATE_EVALUATORS = Object.freeze({
  [AUTHORIZATION_GATE_IDS.PIPELINE_HEALTH]: evaluatePipelineHealthGate,
  [AUTHORIZATION_GATE_IDS.LIFECYCLE_READINESS]: evaluateLifecycleReadinessGate,
  [AUTHORIZATION_GATE_IDS.DRAFT_READINESS]: evaluateDraftReadinessGate,
  [AUTHORIZATION_GATE_IDS.CANDIDATE_RESOLUTION]: evaluateCandidateResolutionGate,
  [AUTHORIZATION_GATE_IDS.EDITORIAL_READINESS]: evaluateEditorialReadinessGate,
  [AUTHORIZATION_GATE_IDS.SEO_READINESS]: evaluateSeoReadinessGate,
  [AUTHORIZATION_GATE_IDS.CONFIGURATION_INTEGRITY]:
    evaluateConfigurationIntegrityGate,
  [AUTHORIZATION_GATE_IDS.REQUIRED_HUMAN_APPROVALS]: evaluateHumanApprovalsGate,
});

/**
 * Evaluate all authorization gates against observation snapshots.
 * Deterministic. No automatic approval. No side effects.
 *
 * @param {object} [observations]
 * @param {object} [registry]
 */
function evaluateAuthorizationGates(observations = {}, registry) {
  const gateRegistry = registry || getDefaultAuthorizationGateRegistry();
  const results = [];

  for (let i = 0; i < gateRegistry.gates.length; i += 1) {
    const gate = gateRegistry.gates[i];
    const evaluator = GATE_EVALUATORS[gate.gateId];
    if (typeof evaluator === 'function') {
      results.push(evaluator(observations));
    } else {
      results.push(
        createGateResult(gate.gateId, GATE_RESULT.BLOCKED, {
          name: gate.name,
          summary: gate.summary,
          message: `No evaluator registered for gate ${gate.gateId}.`,
          reusedModules: gate.reusedModules,
        })
      );
    }
  }

  const passCount = results.filter((r) => r.result === GATE_RESULT.PASS).length;
  const warningCount = results.filter(
    (r) => r.result === GATE_RESULT.WARNING
  ).length;
  const blockedCount = results.filter(
    (r) => r.result === GATE_RESULT.BLOCKED
  ).length;

  return deepFreeze({
    evaluationId: 'AUTHORIZATION_GATES_EVALUATION',
    version: AUTHORIZATION_GATES_VERSION,
    advisoryOnly: true,
    automaticApproval: false,
    publishingDenied: true,
    deploymentDenied: true,
    gateCount: results.length,
    passCount,
    warningCount,
    blockedCount,
    results,
    blockedGateIds: results
      .filter((r) => r.result === GATE_RESULT.BLOCKED)
      .map((r) => r.gateId),
    warningGateIds: results
      .filter((r) => r.result === GATE_RESULT.WARNING)
      .map((r) => r.gateId),
    passedGateIds: results
      .filter((r) => r.result === GATE_RESULT.PASS)
      .map((r) => r.gateId),
  });
}

module.exports = {
  AUTHORIZATION_GATES_VERSION,
  GATE_RESULT,
  AUTHORIZATION_GATE_IDS,
  DEFAULT_AUTHORIZATION_GATE_CATALOG,
  createAuthorizationGateRegistry,
  getDefaultAuthorizationGateRegistry,
  createGateResult,
  evaluateAuthorizationGates,
  evaluatePipelineHealthGate,
  evaluateLifecycleReadinessGate,
  evaluateDraftReadinessGate,
  evaluateCandidateResolutionGate,
  evaluateEditorialReadinessGate,
  evaluateSeoReadinessGate,
  evaluateConfigurationIntegrityGate,
  evaluateHumanApprovalsGate,
};
