"use strict";

/**
 * PWP Phase 5 — Deterministic compatibility and production-gate validation.
 */

const { CHECK_SEVERITY } = require("./readinessTypes");

function issue(code, message, area, severity = CHECK_SEVERITY.ERROR) {
  return { code, message, area, severity };
}

function sameSequence(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function validateProductionManifest(manifest) {
  const checks = [];
  const warnings = [];
  const errors = [];

  function pass(code, area) {
    checks.push({ code, area, valid: true });
  }

  function fail(code, message, area, severity = CHECK_SEVERITY.ERROR) {
    const finding = issue(code, message, area, severity);
    checks.push({ code, area, valid: false });
    if (severity === CHECK_SEVERITY.WARNING) warnings.push(finding);
    else errors.push(finding);
  }

  const pipeline = manifest.pipeline || {};
  const expectedOrder = pipeline.expectedStageOrder || [];
  const actualOrder = pipeline.actualStageOrder || [];

  if (sameSequence(expectedOrder, actualOrder)) {
    pass("STAGE_ORDER_VALID", "pipeline");
  } else {
    fail("STAGE_ORDER_MISMATCH", "Pipeline stages are missing, duplicated, or out of order.", "pipeline");
  }

  for (const stageId of expectedOrder) {
    if (pipeline.runners && pipeline.runners[stageId] === true) {
      pass(`RUNNER_AVAILABLE:${stageId}`, "pipeline");
    } else {
      fail("MISSING_STAGE", `Required stage runner is unavailable: ${stageId}.`, stageId);
    }
  }

  const mappedStates = expectedOrder.map(
    (stageId) => pipeline.stageToState && pipeline.stageToState[stageId]
  );
  if (mappedStates.every(Boolean) && sameSequence(mappedStates, pipeline.stateSequence || [])) {
    pass("STATE_ORDER_VALID", "workflow_state");
  } else {
    fail(
      "STATE_ORDER_MISMATCH",
      "Workflow state mapping does not match the required stage order.",
      "workflow_state"
    );
  }

  if (
    manifest.identifiers &&
    typeof manifest.identifiers.orchestratorId === "string" &&
    manifest.identifiers.orchestratorId.trim() &&
    typeof manifest.identifiers.readinessProbeId === "string" &&
    manifest.identifiers.readinessProbeId.trim()
  ) {
    pass("REQUIRED_IDENTIFIERS_VALID", "identifiers");
  } else {
    fail("MISSING_REQUIRED_IDENTIFIER", "Required workflow identifiers are unavailable.", "identifiers");
  }

  const contracts = manifest.contracts || {};
  if (contracts.stageInputValid === true && contracts.stageResultValid === true) {
    pass("PIPELINE_CONTRACT_VALID", "contracts");
  } else {
    fail("BROKEN_PIPELINE_CONTRACT", "Stage input or output contract validation failed.", "contracts");
  }

  const requiredStatuses = ["SUCCESS", "FAILED", "SKIPPED"];
  if (requiredStatuses.every((status) => (contracts.supportedStatuses || []).includes(status))) {
    pass("STAGE_STATUSES_VALID", "contracts");
  } else {
    fail("BROKEN_STATUS_CONTRACT", "Pipeline stage status contract is incomplete.", "contracts");
  }

  for (const [name, component] of Object.entries(manifest.components || {})) {
    if (component && component.available === true) {
      pass(`COMPONENT_AVAILABLE:${name}`, name);
    } else {
      fail("COMPONENT_UNAVAILABLE", `Required integration is unavailable: ${name}.`, name);
    }

    if (component && component.expectedVersion != null) {
      if (component.version === component.expectedVersion) {
        pass(`VERSION_COMPATIBLE:${name}`, name);
      } else {
        fail(
          "VERSION_MISMATCH",
          `${name} version ${component.version || "missing"} is incompatible with ${component.expectedVersion}.`,
          name
        );
      }
    }
  }

  const generator = (manifest.boundaries && manifest.boundaries.generator) || {};
  const generatorBoundaryIntact =
    generator.mayAccessMonitoring === false &&
    generator.mayAccessProgram1 === false &&
    generator.mayAccessProgram2 === false &&
    generator.mayAccessProgram3 === false &&
    generator.mayAccessResolutionEngine === false &&
    generator.mayRenderFromSuppliedPackageOnly === true &&
    generator.mayPublish === false &&
    generator.mayUseAi === false;
  if (generatorBoundaryIntact) {
    pass("GENERATOR_BOUNDARY_INTACT", "generator");
  } else {
    fail(
      "GENERATOR_BOUNDARY_BROKEN",
      "Generator is not confined to the supplied package boundary.",
      "generator",
      CHECK_SEVERITY.BLOCKING
    );
  }

  const editorial = (manifest.boundaries && manifest.boundaries.editorial) || {};
  const editorialBoundaryIntact =
    editorial.mayAccessMonitoring === false &&
    editorial.mayAccessProgram1 === false &&
    editorial.mayAccessProgram2 === false &&
    editorial.mayAccessProgram3 === false &&
    editorial.mayAccessResolutionEngine === false &&
    editorial.mayAccessGeneratorInternals === false &&
    editorial.mayConsumeEditorialPackageOnly === true &&
    editorial.mayPublish === false &&
    editorial.mayRenderHtml === false &&
    editorial.mayUseAi === false &&
    editorial.mayAutoApprove === false;
  if (editorialBoundaryIntact) {
    pass("EDITORIAL_BOUNDARY_INTACT", "editorial");
  } else {
    fail(
      "EDITORIAL_BOUNDARY_BROKEN",
      "Editorial review boundary permits an unsafe upstream, publishing, or approval path.",
      "editorial",
      CHECK_SEVERITY.BLOCKING
    );
  }

  const telegram = (manifest.boundaries && manifest.boundaries.telegram) || {};
  if (
    telegram.available === true &&
    telegram.requiresExplicitDelivery === true &&
    telegram.automaticSending === false
  ) {
    pass("TELEGRAM_BOUNDARY_INTACT", "telegram");
  } else {
    fail(
      "TELEGRAM_BOUNDARY_BROKEN",
      "Telegram integration is unavailable or permits automatic sending.",
      "telegram",
      CHECK_SEVERITY.BLOCKING
    );
  }

  const gates = manifest.gates || {};
  if (
    gates.autoPublishEnabled === false &&
    gates.policyAutoPublishEnabled === false &&
    gates.autoPublishBlocked === true
  ) {
    pass("AUTO_PUBLISH_DISABLED", "publishing");
  } else {
    fail(
      "AUTO_PUBLISH_ENABLED",
      "AUTO_PUBLISH_ENABLED must remain false and blocked.",
      "publishing",
      CHECK_SEVERITY.BLOCKING
    );
  }

  if (
    gates.manualPublishOnly === true &&
    gates.manualApprovalRequired === true &&
    gates.noBypassPath === true
  ) {
    pass("MANUAL_PUBLISH_GATE_INTACT", "publishing");
  } else {
    fail(
      "MANUAL_PUBLISH_GATE_BROKEN",
      "Manual approval is not required or a publish-gate bypass exists.",
      "publishing",
      CHECK_SEVERITY.BLOCKING
    );
  }

  return {
    valid: errors.length === 0,
    blocked: errors.some((entry) => entry.severity === CHECK_SEVERITY.BLOCKING),
    checks,
    warnings,
    errors
  };
}

module.exports = {
  sameSequence,
  validateProductionManifest
};
