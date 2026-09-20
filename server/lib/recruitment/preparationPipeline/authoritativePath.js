"use strict";

/**
 * Preparation Pipeline — authoritative live-path map.
 *
 * Do NOT invent a second matching engine. Live production path is AMP-4B
 * productionRuntime. CIP / noticeIntelligence libraries are advisory or
 * library-only unless explicitly wired below.
 *
 * Automation remains OFF by default. This document is code-level guidance
 * for readiness — not an activation switch.
 */

const AUTHORITATIVE_PATH = Object.freeze({
  orchestrator: "server/lib/recruitment/productionRuntime/index.js",
  matching: "server/lib/recruitment/lifecycleMatching.js",
  safetyGate: "server/lib/recruitment/lifecycleSafety.js",
  eventClassification: "server/lib/recruitment/eventTypeClassifier.js",
  documentHash: "server/lib/recruitment/lifecycleDocumentIdentity.js",
  canonicalPage: "server/lib/recruitment/canonicalPublicPage.js",
  pdfDownload: "server/lib/recruitment/productionRuntime/downloadOfficialPdfForGeneratorExtraction.js",
  pdfExtractOcr: "server/services/pdfGeneratorExtract.service.js",
  aiConvert: "server/lib/recruitment/productionRuntime/applyGeneratorAiConvert.js",
  publisherValidation: "server/lib/recruitment/publisherDraftValidation.js",
  preparationPipeline: "server/lib/recruitment/preparationPipeline/",
  draftService: "server/services/generatorDraft.service.js",
  reviewService: "server/services/recruitmentReview.service.js",
  automationFlags: "server/config/automationFlags.js"
});

/** Shadow / library-only layers — do not treat as live persistence authority. */
const LIBRARY_ONLY = Object.freeze({
  cipPdfExtraction: "server/lib/contentIntelligence/pdfExtraction/ (no OCR/download)",
  cipDocumentClassification: "server/lib/contentIntelligence/documentClassification/",
  cipAiDraftGeneration: "server/lib/contentIntelligence/aiDraftGeneration/ (structured schema; not live LLM bridge)",
  cipSectionMapper: "server/lib/contentIntelligence/canonicalDraftTransformation/",
  noticeIntelligence: "server/lib/noticeIntelligence/ (advisory taxonomy)"
});

function describeAuthoritativePath() {
  return {
    live: AUTHORITATIVE_PATH,
    libraryOnly: LIBRARY_ONLY,
    productRules: {
      oneRecruitmentOneCanonicalPage: true,
      automationPreparesOnly: true,
      humanPublishOnly: true,
      autoPublishImpossible: true,
      downstreamNeverAutoCreatesRecruitment: true
    }
  };
}

module.exports = {
  AUTHORITATIVE_PATH,
  LIBRARY_ONLY,
  describeAuthoritativePath
};
