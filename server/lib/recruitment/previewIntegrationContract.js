"use strict";

/**
 * Phase 59 — Preview Integration Contract (read-only).
 *
 * Reusable contract for business components that need normalized capability
 * information during preview integration. Depends only on the Phase 57
 * capability consumer output — never accesses Registry, Access API, Resolver,
 * Observation, Validation, Awareness, or Context directly.
 *
 * No normalization duplication: consumer output is accepted as-is when it
 * matches the expected read-only shape. No mutation, no caching, no runtime
 * state changes, and no advisory projection.
 */

const {
  CONSUMER_PHASE,
  CONTEXT_READ_PHASE,
  consumePreviewRuntimeCapabilityContextRead,
  isRuntimeCapabilityContextReadShape
} = require("./runtimeCapabilityPreviewIntegration");

const CONTRACT_PHASE = 59;

/**
 * Verify normalized capability information produced by the Phase 57 consumer.
 * Reuses the consumer shape guard — no duplicate normalization.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isPreviewIntegrationCapabilityInfo(value) {
  return isRuntimeCapabilityContextReadShape(value);
}

/**
 * Expose normalized read-only capability information from Phase 57 consumer
 * output only. Returns the frozen consumer reference when valid, otherwise
 * null. Never mutates the supplied value. Never throws.
 *
 * @param {Readonly<Object>|null|undefined} consumerOutput Phase 57 consumer output
 * @returns {Readonly<Object>|null}
 */
function readPreviewIntegrationCapability(consumerOutput) {
  try {
    if (!isPreviewIntegrationCapabilityInfo(consumerOutput)) {
      return null;
    }

    return consumerOutput;
  } catch {
    return null;
  }
}

/**
 * Fulfill the preview integration contract from an internal Phase 55 context-read
 * snapshot by delegating to the Phase 57 consumer. Returns normalized read-only
 * information or null. Never mutates inputs. Never throws.
 *
 * @param {Readonly<Object>|null|undefined} contextRead internal Phase 55 read
 * @returns {Readonly<Object>|null}
 */
function fulfillPreviewIntegrationContract(contextRead) {
  try {
    return readPreviewIntegrationCapability(
      consumePreviewRuntimeCapabilityContextRead(contextRead)
    );
  } catch {
    return null;
  }
}

module.exports = {
  CONTRACT_PHASE,
  CONSUMER_PHASE,
  CONTEXT_READ_PHASE,
  isPreviewIntegrationCapabilityInfo,
  readPreviewIntegrationCapability,
  fulfillPreviewIntegrationContract
};
