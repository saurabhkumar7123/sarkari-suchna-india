"use strict";

/**
 * Phase 62 — Execution Diagnostics Capability Integration (observation only).
 *
 * Fulfills the Preview Integration Contract for Execution Diagnostics during
 * preview runtime initialization. Depends only on the contract and the
 * internal Phase 55 context-read snapshot — never accesses registry, resolver,
 * observation, validation, awareness, or context directly.
 *
 * The normalized capability is stored only inside Execution Diagnostics
 * internal observation (WeakMap). Never projected into traces, summaries,
 * metadata, worker outputs, or runtime state.
 */

const { fulfillPreviewIntegrationContract } = require("./previewIntegrationContract");
const { peekRuntimeCapabilityContextRead } = require("./runtimeCapabilityContextRead");
const {
  observeExecutionDiagnosticsCapability
} = require("./executionDiagnostics");

const INTEGRATION_PHASE = 62;

/**
 * Phase 62 diagnostics-path inspection. Fulfills the Preview Integration
 * Contract against the already-stored Phase 55 read snapshot and records the
 * normalized value inside Execution Diagnostics only.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Readonly<Object>|null}
 */
function inspectExecutionDiagnosticsCapability(runtimeObject) {
  try {
    return observeExecutionDiagnosticsCapability(
      runtimeObject,
      fulfillPreviewIntegrationContract(
        peekRuntimeCapabilityContextRead(runtimeObject)
      )
    );
  } catch {
    return observeExecutionDiagnosticsCapability(runtimeObject, null);
  }
}

module.exports = {
  INTEGRATION_PHASE,
  inspectExecutionDiagnosticsCapability
};
