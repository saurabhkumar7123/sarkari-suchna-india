"use strict";

/**
 * Phase 51 — First Runtime Capability Consumption (observation only).
 *
 * Resolves one existing capability via the Phase 50 Runtime Capability
 * Resolver during preview runtime initialization and stores the result in
 * an internal WeakMap. The observation is never exposed as a public
 * runtime field, never projected into advisory metadata, never used for branching,
 * enablement, or execution.
 *
 * Phase 52 — structurally validates the observed capability via the Runtime
 * Capability Validator. The validation result is stored only on the internal
 * observation (WeakMap), never exposed publicly, never written into runtime
 * metadata, never logged, never thrown for failures, and never used to change
 * runtime behavior.
 *
 * Phase 53 — builds normalized Preview Runtime Capability Awareness from the
 * validated observation and stores it in an internal WeakMap only. Awareness
 * is never exposed publicly, never written into runtime metadata, never
 * projected into worker outputs, never logged, never used for branching or
 * enablement, and never changes runtime outputs.
 *
 * Phase 54 — builds an internal Preview Runtime Capability Context container
 * from the Phase 53 awareness value only (no re-resolve, no registry/access/
 * resolver access, no awareness rebuild). Context is stored in an internal
 * WeakMap only — never exposed publicly, never written into runtime metadata,
 * never projected into worker outputs, never logged, never used for branching
 * or enablement, and never changes runtime outputs. Context creation failures
 * never affect runtime behavior.
 *
 * Phase 55 — performs the first internal read of the Phase 54 context during
 * initialization (peek only — no context mutation, no rebuild, no awareness
 * recreation, no re-resolve). Read snapshot is stored in an internal WeakMap
 * only — never exposed publicly, never written into runtime metadata, never
 * projected into worker outputs, never logged, never used for branching or
 * enablement, and never changes runtime outputs. Read failures never affect
 * runtime behavior.
 *
 * Phase 56 — invokes the Preview Runtime Capability Integration Hook
 * immediately after context read with the runtime object and internal read
 * snapshot.
 *
 * Phase 57 — the integration hook is the first official capability consumer
 * (observation-only). It inspects the Phase 55 read snapshot, verifies its
 * shape, and normalizes local references only — no snapshot mutation, no
 * rebuild, no branching on snapshot values, no feature enablement, no metadata
 * changes, and no runtime mutations. Hook failures never affect runtime
 * behavior.
 *
 * Phase 58 — the Preview Advisory preparation path may inspect that same
 * normalized consumed capability. The inspection is observation-only: it does
 * not branch on capability values and cannot modify advisory output, metadata,
 * rendering, or runtime state.
 *
 * Phase 59 — Preview Advisory inspection fulfills the Preview Integration
 * Contract instead of reading the Phase 57 consumer directly. The contract
 * depends only on consumer output and never accesses registry, resolver,
 * observation, validation, awareness, or context modules.
 *
 * Phase 62 — Execution Diagnostics inspection fulfills the same Preview
 * Integration Contract during runtime initialization. The normalized capability
 * is stored only inside Execution Diagnostics internal observation and never
 * projected into traces, metadata, or runtime outputs.
 *
 * Optional and non-breaking: unexpected resolution failures leave the
 * existing runtime object unchanged. No database, worker, adapter, pipeline,
 * or enablement changes.
 */

const { resolveCapability } = require("./runtimeCapabilityResolver");
const {
  validateObservedCapability
} = require("./runtimeCapabilityValidation");
const {
  attachRuntimeCapabilityAwareness
} = require("./runtimeCapabilityAwareness");
const {
  attachRuntimeCapabilityContext
} = require("./runtimeCapabilityContext");
const {
  readRuntimeCapabilityContext,
  peekRuntimeCapabilityContextRead
} = require("./runtimeCapabilityContextRead");
const { invokePreviewRuntimeCapabilityIntegration } = require("./runtimeCapabilityPreviewIntegration");
const { fulfillPreviewIntegrationContract } = require("./previewIntegrationContract");
const {
  inspectExecutionDiagnosticsCapability
} = require("./executionDiagnosticsCapabilityIntegration");

const CONSUMPTION_PHASE = 51;

/**
 * First observed capability id (existing catalog entry).
 * Hard-coded string so this module never imports the registry.
 * @type {string}
 */
const OBSERVED_CAPABILITY_ID = "preview_runtime_wiring";

/**
 * Internal observation store keyed by the runtime result object.
 * Not enumerable, not JSON-serializable, not a public field.
 * @type {WeakMap<Object, Readonly<{
 *   phase: number,
 *   observationOnly: boolean,
 *   capabilityId: string,
 *   capability: Object|null,
 *   validation: Readonly<Object>
 * }>>}
 */
const observedCapabilityByRuntime = new WeakMap();

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Resolve one capability and attach the observation (plus Phase 52 structural
 * validation, Phase 53 awareness derived from that validated observation, and
 * Phase 54 context derived from that awareness, Phase 55 one-time context read,
 * and Phase 56 preview integration hook) internally.
 * Never mutates public fields. Never branches on capability, validation,
 * awareness, context, or read state. On unexpected failure, returns the original
 * runtime object unchanged.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Object|null|undefined} same runtime reference (or original on failure)
 */
function observeRuntimeCapability(runtimeObject) {
  if (!isPlainObject(runtimeObject)) {
    return runtimeObject;
  }

  try {
    const capability = resolveCapability(OBSERVED_CAPABILITY_ID, runtimeObject);
    const validation = validateObservedCapability(
      capability,
      OBSERVED_CAPABILITY_ID
    );

    const observation = Object.freeze({
      phase: CONSUMPTION_PHASE,
      observationOnly: true,
      capabilityId: OBSERVED_CAPABILITY_ID,
      capability,
      validation
    });

    observedCapabilityByRuntime.set(runtimeObject, observation);

    // Phase 53 — normalized awareness from the validated observation only.
    // Phase 54 — context container from that awareness value (no rebuild).
    // Phase 55 — one-time informational read of that context (no mutation).
    // Phase 56/57 — integration hook consumes context read (observation-only).
    // Failures here must not alter runtime behavior.
    attachRuntimeCapabilityContext(
      runtimeObject,
      attachRuntimeCapabilityAwareness(runtimeObject, observation)
    );
    readRuntimeCapabilityContext(runtimeObject);
    invokePreviewRuntimeCapabilityIntegration(
      runtimeObject,
      peekRuntimeCapabilityContextRead(runtimeObject)
    );

    // Phase 62 — diagnostics-path observation only via Preview Integration
    // Contract. The normalized capability is deliberately not projected.
    const diagnosticsCapability = inspectExecutionDiagnosticsCapability(runtimeObject);
    void diagnosticsCapability;
  } catch {
    // Optional / non-breaking: preserve existing runtime behavior.
  }

  return runtimeObject;
}

/**
 * Phase 58/59 advisory inspection. Fulfills the Preview Integration Contract
 * against the already-stored Phase 55 read snapshot. The returned normalized
 * value is for local observation only and never drives advisory fields or
 * runtime behavior.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Readonly<Object>|null}
 */
function inspectPreviewAdvisoryCapability(runtimeObject) {
  try {
    return fulfillPreviewIntegrationContract(
      peekRuntimeCapabilityContextRead(runtimeObject)
    );
  } catch {
    return null;
  }
}

/**
 * Phase 62 diagnostics inspection. Delegates to the Execution Diagnostics
 * integration hook, which fulfills the Preview Integration Contract.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Readonly<Object>|null}
 */
function inspectPreviewExecutionDiagnosticsCapability(runtimeObject) {
  try {
    return inspectExecutionDiagnosticsCapability(runtimeObject);
  } catch {
    return null;
  }
}

/**
 * Read the internal capability observation for a runtime result, if any.
 * For architecture / tests only — not part of public advisory projections.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Readonly<{
 *   phase: number,
 *   observationOnly: boolean,
 *   capabilityId: string,
 *   capability: Object|null,
 *   validation: Readonly<Object>
 * }>|null}
 */
function peekObservedRuntimeCapability(runtimeObject) {
  if (!isPlainObject(runtimeObject)) {
    return null;
  }
  const observation = observedCapabilityByRuntime.get(runtimeObject);
  return observation == null ? null : observation;
}

/**
 * Read the internal Phase 52 validation result for a runtime observation, if any.
 * For architecture / tests only — never a public runtime field.
 *
 * @param {Object|null|undefined} runtimeObject
 * @returns {Readonly<Object>|null}
 */
function peekObservedRuntimeCapabilityValidation(runtimeObject) {
  const observation = peekObservedRuntimeCapability(runtimeObject);
  return observation == null ? null : observation.validation ?? null;
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isRuntimeCapabilityObservation(value) {
  return (
    isPlainObject(value) &&
    value.phase === CONSUMPTION_PHASE &&
    value.observationOnly === true &&
    value.capabilityId === OBSERVED_CAPABILITY_ID &&
    Object.prototype.hasOwnProperty.call(value, "capability")
  );
}

module.exports = {
  CONSUMPTION_PHASE,
  OBSERVED_CAPABILITY_ID,
  observeRuntimeCapability,
  inspectPreviewAdvisoryCapability,
  inspectPreviewExecutionDiagnosticsCapability,
  peekObservedRuntimeCapability,
  peekObservedRuntimeCapabilityValidation,
  isRuntimeCapabilityObservation
};
