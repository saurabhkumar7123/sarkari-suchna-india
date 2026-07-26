"use strict";

/**
 * PWP Phase 1 — Stage runners.
 * Each runner wraps an existing production module. No engines are reimplemented.
 */

const websiteChangeDetection = require("../monitoringBot/websiteChangeDetection");
const sourceIntelligence = require("../contentIntelligence/sourceIntelligence");
const htmlExtraction = require("../contentIntelligence/htmlExtraction");
const pdfExtraction = require("../contentIntelligence/pdfExtraction");
const multiSourceCorrelation = require("../contentIntelligence/multiSourceCorrelation");
const extractionQuality = require("../contentIntelligence/extractionQuality");
const documentClassification = require("../contentIntelligence/documentClassification");
const metadataIntelligence = require("../contentIntelligence/metadataIntelligence");
const structureIntelligence = require("../contentIntelligence/structureIntelligence");
const validationEngine = require("../contentIntelligence/validationEngine");
const aiDraftPreparation = require("../contentIntelligence/aiDraftPreparation");
const aiDraftGeneration = require("../contentIntelligence/aiDraftGeneration");
const aiResponseGovernance = require("../contentIntelligence/aiResponseGovernance");
const canonicalDraftTransformation = require("../contentIntelligence/canonicalDraftTransformation");
const editorialDecisionSupport = require("../contentIntelligence/editorialDecisionSupport");
const telegramNotification = require("../monitoringBot/telegramNotification");
const { createReviewItem, REVIEW_STATUS } = require("../recruitment/reviewQueue");
const { STAGE_STATUS, createStageResult } = require("./pipelineContracts");
const {
  resolveProgram1Text,
  buildPassThroughAiResponse,
  buildGeneratorDraftFromCanonical,
  collapseWhitespace
} = require("./contentAdapters");
const { evaluateManualPublishGate, assertAutoPublishDisabled } = require("./publishingPolicy");
const {
  resolveRecruitment,
  RESOLUTION_DECISIONS
} = require("./recruitmentResolution");
const { WORKFLOW_STATES } = require("./workflowStates");
const {
  shouldRunGenerator,
  shouldRunEditorialQueue
} = require("./recruitmentResolution/routingModel");

function fail(errors, warnings = [], payload = null, executionSummary = {}) {
  return createStageResult({
    status: STAGE_STATUS.FAILED,
    payload,
    warnings,
    errors: Array.isArray(errors) ? errors : [errors],
    executionSummary
  });
}

function ok(payload, warnings = [], executionSummary = {}) {
  return createStageResult({
    status: STAGE_STATUS.SUCCESS,
    payload,
    warnings,
    errors: [],
    executionSummary
  });
}

function runSourceDetection(stageInput) {
  const event =
    (stageInput.workflowContext && stageInput.workflowContext.monitoringEvent) ||
    stageInput.currentPayload ||
    null;

  if (!event || typeof event !== "object") {
    return fail([{ code: "MISSING_MONITORING_EVENT", message: "monitoring event is required" }]);
  }

  const sourceUrl =
    collapseWhitespace(event.sourceUrl || event.url || event.source?.url) || null;
  if (!sourceUrl && !event.html && !event.pdf && !Array.isArray(event.documents)) {
    return fail([
      {
        code: "EMPTY_MONITORING_EVENT",
        message: "monitoring event must include sourceUrl and/or document content"
      }
    ]);
  }

  return ok(
    {
      monitoringEvent: event,
      sourceUrl,
      recruitmentId: stageInput.recruitmentId || event.recruitmentId || null,
      detectedAt: event.detectedAt || new Date().toISOString()
    },
    [],
    { stage: "SOURCE_DETECTION", reused: "Monitoring Bot event intake" }
  );
}

function runChangeDetection(stageInput) {
  const ctx = stageInput.workflowContext || {};
  const event = ctx.monitoringEvent || {};
  const prior = stageInput.currentPayload || {};
  const warnings = [];

  if (event.changeDetection && typeof event.changeDetection === "object") {
    const status = event.changeDetection.detectionStatus || event.changeDetection.status;
    if (status === websiteChangeDetection.DETECTION_STATUS?.NO_CHANGE || status === "NO_CHANGE") {
      return fail(
        [{ code: "NO_CHANGE", message: "website change detection reported NO_CHANGE" }],
        warnings,
        { changeDetection: event.changeDetection },
        { stage: "CHANGE_DETECTION", mode: "precomputed" }
      );
    }
    return ok(
      {
        ...prior,
        changeDetection: event.changeDetection,
        changeDetected: true
      },
      warnings,
      { stage: "CHANGE_DETECTION", mode: "precomputed", reused: "Website Change Detection" }
    );
  }

  const content =
    event.html ||
    event.content ||
    (typeof event.text === "string" ? event.text : null) ||
    "";

  if (!content && event.forceChangeDetected !== true && !event.previousFingerprint) {
    // Monitoring already handed us a detection-worthy event without baseline.
    warnings.push("No previous fingerprint; treating monitoring event as change detected.");
    return ok(
      {
        ...prior,
        changeDetection: {
          detectionStatus: "CHANGED",
          reason: "monitoring_event_without_baseline"
        },
        changeDetected: true
      },
      warnings,
      { stage: "CHANGE_DETECTION", mode: "advisory_default" }
    );
  }

  try {
    const currentFp = websiteChangeDetection.generateContentFingerprint({
      body: content || String(event.sourceUrl || prior.sourceUrl || "empty"),
      contentType: event.contentType || "text/html"
    });
    const previousFp =
      event.previousFingerprint ||
      (event.forceChangeDetected
        ? websiteChangeDetection.generateContentFingerprint({
            body: "__previous_absent__",
            contentType: event.contentType || "text/html"
          })
        : currentFp);

    const detection = websiteChangeDetection.detectChange({
      currentFingerprint: currentFp,
      previousFingerprint: previousFp,
      contentType: event.contentType || "text/html"
    });

    if (detection.detectionStatus === websiteChangeDetection.DETECTION_STATUS.NO_CHANGE) {
      return fail(
        [{ code: "NO_CHANGE", message: "no website change detected" }],
        warnings,
        { changeDetection: detection },
        { stage: "CHANGE_DETECTION", mode: "fingerprint" }
      );
    }

    return ok(
      {
        ...prior,
        changeDetection: detection,
        changeDetected: true,
        currentFingerprint: currentFp
      },
      warnings,
      { stage: "CHANGE_DETECTION", mode: "fingerprint", reused: "Website Change Detection" }
    );
  } catch (err) {
    return fail(
      [{ code: "CHANGE_DETECTION_ERROR", message: err.message || String(err) }],
      warnings
    );
  }
}

function runSourceIntelligence(stageInput) {
  const event = (stageInput.workflowContext && stageInput.workflowContext.monitoringEvent) || {};
  const prior = stageInput.currentPayload || {};
  const warnings = [];

  try {
    const input = {
      url: event.sourceUrl || event.url || prior.sourceUrl || null,
      title: event.title || null,
      contentType: event.contentType || null,
      html: event.html || null,
      text: event.text || null,
      filename: event.filename || null,
      ...(event.sourceProfileInput || {})
    };

    let profile;
    if (
      typeof event.html === "string" ||
      (event.contentType || "").includes("html") ||
      /\.html?$/i.test(input.url || "")
    ) {
      profile = sourceIntelligence.analyzeSourceFromHtml({ ...input, html: event.html || null });
    } else if (
      event.pdf ||
      (event.contentType || "").includes("pdf") ||
      /\.pdf$/i.test(input.url || "")
    ) {
      profile = sourceIntelligence.analyzeSourceFromPdf(input);
    } else if (input.url) {
      profile = sourceIntelligence.analyzeSourceFromUrl(input.url, input);
    } else {
      profile = sourceIntelligence.analyzeSource(input);
    }

    if (Array.isArray(profile.warnings)) warnings.push(...profile.warnings);

    return ok(
      { ...prior, sourceProfile: profile },
      warnings,
      {
        stage: "SOURCE_INTELLIGENCE_3A",
        sourceType: profile.classification && profile.classification.sourceType,
        reused: "CIP Stage 3A"
      }
    );
  } catch (err) {
    return fail([{ code: "SOURCE_INTELLIGENCE_ERROR", message: err.message || String(err) }]);
  }
}

function extractOneDocument(item, sourceProfile) {
  if (!item || typeof item !== "object") {
    throw new Error("document item must be an object");
  }

  if (item.normalizedDocument && typeof item.normalizedDocument === "object") {
    return item.normalizedDocument;
  }
  if (item.document && item.document.formatId) {
    return item.document;
  }

  const kind = String(item.kind || item.type || "").toLowerCase();
  const sourceUrl = item.sourceUrl || item.url || null;

  if (kind === "html" || typeof item.html === "string") {
    return htmlExtraction.extractHtmlFromSourceProfile(item.html, sourceProfile, {
      sourceUrl,
      ...(item.options || {})
    });
  }

  if (kind === "pdf" || item.pdf || item.buffer) {
    return pdfExtraction.extractPdfFromSourceProfile(item.pdf || item.buffer, sourceProfile, {
      sourceUrl,
      ...(item.options || {})
    });
  }

  throw new Error(`unsupported document kind: ${kind || "unknown"}`);
}

function runContentExtraction(stageInput) {
  const event = (stageInput.workflowContext && stageInput.workflowContext.monitoringEvent) || {};
  const prior = stageInput.currentPayload || {};
  const sourceProfile = prior.sourceProfile || stageInput.sourceProfile;
  const warnings = [];
  const extractedDocuments = [];

  try {
    const docs = Array.isArray(event.documents) ? event.documents.slice() : [];

    if (!docs.length) {
      if (typeof event.html === "string") {
        docs.push({ kind: "html", html: event.html, sourceUrl: event.sourceUrl || event.url });
      }
      if (event.pdf || event.buffer) {
        docs.push({
          kind: "pdf",
          pdf: event.pdf || event.buffer,
          sourceUrl: event.sourceUrl || event.url
        });
      }
      if (event.normalizedDocument) {
        docs.push({ kind: "normalized", normalizedDocument: event.normalizedDocument });
      }
    }

    if (!docs.length) {
      return fail(
        [{ code: "NO_CONTENT", message: "no HTML/PDF content available for extraction" }],
        warnings,
        prior
      );
    }

    for (const item of docs) {
      const doc = extractOneDocument(item, sourceProfile);
      extractedDocuments.push(doc);
      if (Array.isArray(doc.warnings)) warnings.push(...doc.warnings);
    }

    return ok(
      { ...prior, extractedDocuments, primaryDocument: extractedDocuments[0] },
      warnings,
      {
        stage: "CONTENT_EXTRACTION_3B_3C",
        documentCount: extractedDocuments.length,
        reused: "CIP Stage 3B/3C"
      }
    );
  } catch (err) {
    return fail(
      [{ code: "CONTENT_EXTRACTION_ERROR", message: err.message || String(err) }],
      warnings,
      prior
    );
  }
}

function runMultiSourceCorrelation(stageInput) {
  const prior = stageInput.currentPayload || {};
  const warnings = [];
  const docs = Array.isArray(prior.extractedDocuments) ? prior.extractedDocuments : [];

  if (!docs.length) {
    return fail([{ code: "NO_DOCUMENTS", message: "no extracted documents to correlate" }], [], prior);
  }

  try {
    const correlation = multiSourceCorrelation.correlateDocuments(docs);
    if (Array.isArray(correlation.warnings)) warnings.push(...correlation.warnings);

    return ok(
      { ...prior, correlation },
      warnings,
      {
        stage: "MULTI_SOURCE_CORRELATION_3D",
        documentCount: docs.length,
        reused: "CIP Stage 3D"
      }
    );
  } catch (err) {
    return fail(
      [{ code: "CORRELATION_ERROR", message: err.message || String(err) }],
      warnings,
      prior
    );
  }
}

function runExtractionQuality(stageInput) {
  const prior = stageInput.currentPayload || {};
  const warnings = [];

  try {
    // Gate on extracted Stage 3B/3C documents. Correlation views are advisory
    // because Stage 3D document projections may omit full content blocks.
    const docs = Array.isArray(prior.extractedDocuments) ? prior.extractedDocuments : [];
    let report;
    if (docs.length === 1) {
      report = extractionQuality.assessExtractionQuality(docs[0]);
    } else if (docs.length > 1) {
      // Assess each document; block only when every document is blocked.
      const reports = docs.map((doc) => extractionQuality.assessExtractionQuality(doc));
      const anyReady = reports.some(
        (r) =>
          r.readiness &&
          r.readiness.state !== extractionQuality.READINESS_STATES.BLOCKED &&
          !(r.scores && r.scores.overallQuality && r.scores.overallQuality.level === "BLOCKED")
      );
      report = {
        ...reports[0],
        multiDocumentReports: reports,
        readiness: anyReady
          ? reports.find(
              (r) => r.readiness && r.readiness.state !== extractionQuality.READINESS_STATES.BLOCKED
            ).readiness
          : reports[0].readiness,
        scores: reports[0].scores,
        warnings: reports.flatMap((r) => r.warnings || [])
      };
      if (!anyReady) {
        report.readiness = {
          ...(reports[0].readiness || {}),
          state: extractionQuality.READINESS_STATES.BLOCKED,
          ready: false
        };
      }
    } else {
      report = extractionQuality.assessExtractionQuality(
        prior.primaryDocument || prior.correlation
      );
    }

    if (Array.isArray(report.warnings)) warnings.push(...report.warnings);

    let correlationQualityReport = null;
    if (prior.correlation) {
      correlationQualityReport = extractionQuality.assessExtractionQuality(prior.correlation);
      if (Array.isArray(correlationQualityReport.warnings)) {
        warnings.push(...correlationQualityReport.warnings);
      }
    }

    const readinessState = (report.readiness && report.readiness.state) || null;
    const qualityLevel =
      (report.scores &&
        report.scores.overallQuality &&
        report.scores.overallQuality.level) ||
      null;

    if (readinessState === extractionQuality.READINESS_STATES.BLOCKED || qualityLevel === "BLOCKED") {
      return fail(
        [
          {
            code: "QUALITY_BLOCKED",
            message: "extraction quality validation blocked downstream execution"
          }
        ],
        warnings,
        { ...prior, qualityReport: report, correlationQualityReport },
        { stage: "EXTRACTION_QUALITY_3E", readinessState, qualityLevel }
      );
    }

    return ok(
      { ...prior, qualityReport: report, correlationQualityReport },
      warnings,
      {
        stage: "EXTRACTION_QUALITY_3E",
        readinessState,
        qualityLevel,
        reused: "CIP Stage 3E"
      }
    );
  } catch (err) {
    return fail(
      [{ code: "QUALITY_VALIDATION_ERROR", message: err.message || String(err) }],
      warnings,
      prior
    );
  }
}

function runRecruitmentResolution(stageInput) {
  const prior = stageInput.currentPayload || {};
  const ctx = stageInput.workflowContext || {};
  const event = ctx.monitoringEvent || {};
  const warnings = [];

  try {
    const resolution = resolveRecruitment({
      workflowContext: {
        ...ctx,
        monitoringEvent: event,
        title: event.title || null,
        contentType: event.contentType || null,
        forceDuplicate: event.forceDuplicate === true,
        isDuplicateNotification: event.isDuplicateNotification === true,
        unknownRecruitment: event.unknownRecruitment === true,
        forceManualReview: event.forceManualReview === true,
        unsupported: event.unsupported === true,
        updateRecruitmentOnly: event.updateRecruitmentOnly === true,
        preferRecruitmentUpdate: event.preferRecruitmentUpdate === true,
        allowLowConfidenceCreate: event.allowLowConfidenceCreate === true,
        primaryDocumentId: event.primaryDocumentId || null,
        existingRecruitment: ctx.existingRecruitment || event.existingRecruitment || null,
        existingPage: ctx.existingPage || event.existingPage || null
      },
      correlation: prior.correlation || null,
      existingRecruitment: ctx.existingRecruitment || event.existingRecruitment || null,
      existingPage: ctx.existingPage || event.existingPage || null,
      detectedChanges:
        (prior.correlation && prior.correlation.detectedChanges) ||
        event.detectedChanges ||
        []
    });

    const halt = Boolean(resolution.routing && resolution.routing.haltPipeline);
    let haltFinalState = WORKFLOW_STATES.RECRUITMENT_RESOLVED;
    if (resolution.decision === RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED) {
      haltFinalState = WORKFLOW_STATES.READY_FOR_REVIEW;
    } else if (resolution.decision === RESOLUTION_DECISIONS.IGNORE_DUPLICATE) {
      haltFinalState = WORKFLOW_STATES.RECRUITMENT_RESOLVED;
    } else if (resolution.decision === RESOLUTION_DECISIONS.UNSUPPORTED) {
      haltFinalState = WORKFLOW_STATES.RECRUITMENT_RESOLVED;
    }

    return ok(
      {
        ...prior,
        resolution,
        recruitmentResolution: resolution
      },
      warnings,
      {
        stage: "RECRUITMENT_RESOLUTION",
        decision: resolution.decision,
        destinations: resolution.routing && resolution.routing.destinations,
        haltPipeline: halt,
        haltFinalState: halt ? haltFinalState : undefined,
        haltReason: halt ? `resolution:${resolution.decision}` : undefined,
        reused: "PWP Phase 2 Recruitment Resolution Engine"
      }
    );
  } catch (err) {
    return fail(
      [{ code: "RECRUITMENT_RESOLUTION_ERROR", message: err.message || String(err) }],
      warnings,
      prior
    );
  }
}

function runDocumentIntelligence(stageInput) {
  const event = (stageInput.workflowContext && stageInput.workflowContext.monitoringEvent) || {};
  const prior = stageInput.currentPayload || {};
  const warnings = [];

  if (prior.resolution && prior.resolution.routing && prior.resolution.routing.haltPipeline) {
    return ok(
      prior,
      warnings,
      {
        stage: "DOCUMENT_INTELLIGENCE_P1",
        routedSkip: true,
        reason: prior.resolution.decision
      }
    );
  }

  try {
    const text = resolveProgram1Text({
      text: event.program1Text || event.text || null,
      correlation: prior.correlation,
      extractedDocuments: prior.extractedDocuments
    });

    if (!collapseWhitespace(text)) {
      return fail(
        [{ code: "EMPTY_DOCUMENT_TEXT", message: "no text available for Program 1" }],
        warnings,
        prior
      );
    }

    const title =
      event.title ||
      (prior.primaryDocument &&
        prior.primaryDocument.metadata &&
        prior.primaryDocument.metadata.title) ||
      "Detected recruitment";

    const classification = documentClassification.classifyDocumentFromText(text, { title });
    const metadataResult = metadataIntelligence.extractMetadataFromText(text, {
      title,
      url: event.sourceUrl || event.url || prior.sourceUrl || null,
      classification
    });
    const structuredDocument = structureIntelligence.structureDocumentFromText(text, {
      title,
      classification,
      metadataResult
    });
    const validationResult = validationEngine.validateStructuredDocument(structuredDocument);

    if (Array.isArray(classification.warnings)) warnings.push(...classification.warnings);
    if (Array.isArray(metadataResult.warnings)) warnings.push(...metadataResult.warnings);
    if (Array.isArray(structuredDocument.warnings)) warnings.push(...structuredDocument.warnings);
    if (Array.isArray(validationResult.warnings)) warnings.push(...validationResult.warnings);

    if (validationResult.valid === false && event.strictProgram1Validation === true) {
      return fail(
        validationResult.findings || [{ code: "PROGRAM1_INVALID", message: "Program 1 validation failed" }],
        warnings,
        { ...prior, classification, metadataResult, structuredDocument, validationResult },
        { stage: "DOCUMENT_INTELLIGENCE_P1" }
      );
    }

    return ok(
      {
        ...prior,
        program1Text: text,
        classification,
        metadataResult,
        structuredDocument,
        validationResult
      },
      warnings,
      {
        stage: "DOCUMENT_INTELLIGENCE_P1",
        documentType: classification.documentType,
        reused: "CIP Program 1 (1A–1E)"
      }
    );
  } catch (err) {
    return fail(
      [{ code: "DOCUMENT_INTELLIGENCE_ERROR", message: err.message || String(err) }],
      warnings,
      prior
    );
  }
}

function runAiIntelligence(stageInput) {
  const event = (stageInput.workflowContext && stageInput.workflowContext.monitoringEvent) || {};
  const prior = stageInput.currentPayload || {};
  const warnings = [];

  try {
    if (!prior.structuredDocument || !prior.validationResult) {
      return fail(
        [{ code: "MISSING_PROGRAM1", message: "Program 1 outputs required for Program 2" }],
        warnings,
        prior
      );
    }

    const prepared = aiDraftPreparation.prepareAiDraftFromValidated(
      prior.validationResult,
      prior.structuredDocument,
      { pipeline: "production_workflow" }
    );

    const rawResponse =
      event.rawAiResponse ||
      buildPassThroughAiResponse(prepared.payload, {
        title: event.title || null,
        confidence: 0.9
      });

    const generation = aiDraftGeneration.generateAiDraftPackageFromPrepared(prepared, {
      pipeline: "production_workflow",
      rawResponse
    });

    if (!generation.normalizedResponse) {
      return fail(
        [
          {
            code: "AI_RESPONSE_MISSING",
            message: "Program 2 generation produced no normalized response"
          }
        ],
        warnings,
        { ...prior, prepared, generation },
        { stage: "AI_INTELLIGENCE_P2" }
      );
    }

    const governed = aiResponseGovernance.governAiResponseFromGenerationResult(generation, {
      payload: prepared.payload,
      freeze: false
    });

    const readiness =
      (governed.readinessStatus && governed.readinessStatus.status) || null;

    // Explicit hard-block hook for orchestration tests / operator override.
    if (event.forceAiBlocked === true) {
      return fail(
        [{ code: "AI_BLOCKED", message: "AI intelligence blocked downstream execution" }],
        warnings,
        { ...prior, prepared, generation, governed },
        { stage: "AI_INTELLIGENCE_P2", readiness }
      );
    }

    if (readiness === aiResponseGovernance.READINESS_STATUSES.BLOCKED) {
      warnings.push({
        code: "AI_READINESS_BLOCKED",
        message:
          "Program 2 readiness is blocked; continuing to Canonical Package for manual editorial review only."
      });
    }

    const transformed = canonicalDraftTransformation.transformFromGovernanceResult(governed, {
      pipeline: "production_workflow",
      freeze: false
    });

    if (!transformed || !transformed.generatorReadyDocument) {
      return fail(
        [
          {
            code: "CANONICAL_PACKAGE_MISSING",
            message: "Program 2 did not produce a Canonical Recruitment Package"
          }
        ],
        warnings,
        { ...prior, prepared, generation, governed, transformed },
        { stage: "AI_INTELLIGENCE_P2", readiness }
      );
    }

    const decisionSupport = editorialDecisionSupport.supportFromTransformationResult(transformed, {
      freeze: false
    });

    if (Array.isArray(prepared.warnings)) warnings.push(...prepared.warnings);
    if (Array.isArray(transformed.transformationWarnings)) {
      warnings.push(...transformed.transformationWarnings);
    }

    const canonicalRecruitmentPackage =
      transformed.generatorReadyDocument || transformed;

    return ok(
      {
        ...prior,
        prepared,
        generation,
        governed,
        transformed,
        decisionSupport,
        canonicalRecruitmentPackage
      },
      warnings,
      {
        stage: "AI_INTELLIGENCE_P2",
        readiness,
        reused: "CIP Program 2 (2A–2E)",
        executedModel: false
      }
    );
  } catch (err) {
    return fail(
      [{ code: "AI_INTELLIGENCE_ERROR", message: err.message || String(err) }],
      warnings,
      prior
    );
  }
}

function runGeneratorDraft(stageInput) {
  const prior = stageInput.currentPayload || {};
  const event = (stageInput.workflowContext && stageInput.workflowContext.monitoringEvent) || {};
  const warnings = [];

  if (prior.resolution && !shouldRunGenerator(prior.resolution)) {
    return ok(
      { ...prior, generatorDraft: null, generatorSkippedByResolution: true },
      warnings,
      {
        stage: "GENERATOR_DRAFT",
        routedSkip: true,
        reason: prior.resolution.decision,
        reused: "PWP Phase 2 routing"
      }
    );
  }

  if (!prior.canonicalRecruitmentPackage) {
    return fail(
      [
        {
          code: "MISSING_CANONICAL_PACKAGE",
          message: "Generator requires Canonical Recruitment Package from Program 2"
        }
      ],
      warnings,
      prior
    );
  }

  try {
    const draft = buildGeneratorDraftFromCanonical(prior.canonicalRecruitmentPackage, {
      workflowId: stageInput.workflowId,
      recruitmentId: stageInput.recruitmentId || prior.recruitmentId || null,
      sourceUrl: event.sourceUrl || event.url || prior.sourceUrl || null,
      title: event.title || null
    });

    if (!collapseWhitespace(draft.title)) {
      return fail([{ code: "DRAFT_TITLE_MISSING", message: "generator draft missing title" }], warnings);
    }

    const resolution = prior.resolution || null;
    const enrichedDraft = {
      ...draft,
      resolutionDecision: resolution ? resolution.decision : null,
      updatePlan: resolution ? resolution.updatePlan : null
    };

    return ok(
      { ...prior, generatorDraft: enrichedDraft },
      warnings,
      {
        stage: "GENERATOR_DRAFT",
        reused: "Generator draft payload adapter",
        generatorCalledIntelligence: false,
        resolutionDecision: resolution ? resolution.decision : null
      }
    );
  } catch (err) {
    return fail(
      [{ code: "GENERATOR_DRAFT_ERROR", message: err.message || String(err) }],
      warnings,
      prior
    );
  }
}

function runEditorialQueue(stageInput) {
  const prior = stageInput.currentPayload || {};
  const event = (stageInput.workflowContext && stageInput.workflowContext.monitoringEvent) || {};
  const warnings = [];

  if (prior.resolution && !shouldRunEditorialQueue(prior.resolution)) {
    return ok(
      {
        ...prior,
        editorialQueueReference: null,
        editorialSkippedByResolution: true
      },
      warnings,
      {
        stage: "EDITORIAL_QUEUE",
        routedSkip: true,
        reason: prior.resolution.decision,
        reused: "PWP Phase 2 routing"
      }
    );
  }

  if (!prior.generatorDraft) {
    return fail(
      [{ code: "MISSING_DRAFT", message: "editorial queue requires generator draft" }],
      warnings,
      prior
    );
  }

  try {
    const documentType =
      (prior.classification && prior.classification.documentType) ||
      (prior.canonicalRecruitmentPackage &&
        prior.canonicalRecruitmentPackage.metadata &&
        prior.canonicalRecruitmentPackage.metadata.detectedDocumentType) ||
      "new_recruitment";

    const reviewItem = createReviewItem({
      recruitmentId: stageInput.recruitmentId || prior.recruitmentId || event.recruitmentId || null,
      eventType: mapDocumentTypeToEventType(documentType),
      matchResult: {
        match: Boolean(stageInput.recruitmentId || prior.recruitmentId),
        confidence: "medium",
        matchedSignals: [],
        conflictingSignals: []
      },
      confidence: "medium",
      sourceUrl: event.sourceUrl || event.url || prior.sourceUrl || null,
      title: prior.generatorDraft.title,
      createdAt: new Date().toISOString(),
      notes: "PWP Phase 2 — awaiting manual editorial review"
    });

    const queueReference = {
      queue: "editorial_review",
      status: reviewItem.status || REVIEW_STATUS.PENDING,
      workflowId: stageInput.workflowId,
      title: reviewItem.title,
      autoApproved: false,
      reviewItem,
      decisionSupport: prior.decisionSupport || null,
      generatorDraft: prior.generatorDraft,
      resolutionDecision: (prior.resolution && prior.resolution.decision) || null,
      updatePlan: (prior.resolution && prior.resolution.updatePlan) || null,
      routingDestinations:
        (prior.resolution &&
          prior.resolution.routing &&
          prior.resolution.routing.destinations) ||
        null
    };

    return ok(
      { ...prior, editorialQueueReference: queueReference },
      warnings,
      {
        stage: "EDITORIAL_QUEUE",
        reused: "Editorial Review Queue",
        autoApproved: false
      }
    );
  } catch (err) {
    return fail(
      [{ code: "EDITORIAL_QUEUE_ERROR", message: err.message || String(err) }],
      warnings,
      prior
    );
  }
}

function mapDocumentTypeToEventType(documentType) {
  const value = String(documentType || "").toLowerCase();
  if (value.includes("admit")) return "admit_card";
  if (value.includes("answer")) return "answer_key";
  if (value.includes("result")) return "result";
  if (value.includes("corrigendum") || value.includes("correction")) return "correction";
  if (value.includes("short")) return "short_notification";
  if (value.includes("recruitment") || value.includes("notification")) return "notification";
  return "notification";
}

async function runTelegramNotification(stageInput) {
  const prior = stageInput.currentPayload || {};
  const event = (stageInput.workflowContext && stageInput.workflowContext.monitoringEvent) || {};
  const warnings = [];

  if (!prior.editorialQueueReference) {
    return fail(
      [{ code: "MISSING_QUEUE_REF", message: "telegram stage requires editorial queue reference" }],
      warnings,
      prior
    );
  }

  try {
    const telegramSummary =
      (prior.decisionSupport && prior.decisionSupport.telegramSummary) ||
      editorialDecisionSupport.buildTelegramSummary(
        {
          documentType: prior.classification && prior.classification.documentType,
          documentTypeLabel:
            prior.classification && prior.classification.documentTypeLabel,
          organization:
            prior.generatorDraft && prior.generatorDraft.structuredDepartment,
          title: prior.generatorDraft && prior.generatorDraft.title
        },
        (prior.decisionSupport && prior.decisionSupport.decisionSupport) || {}
      );

    const allowDelivery = event.allowTelegramDelivery === true;
    const transport =
      event.telegramTransport ||
      (allowDelivery
        ? telegramNotification.createMemoryTransport()
        : telegramNotification.createNullTransport());

    const delivery = await telegramNotification.deliverTelegramNotification({
      recruitmentTitle: prior.generatorDraft.title,
      department: prior.generatorDraft.structuredDepartment || "",
      source: event.sourceUrl || event.url || prior.sourceUrl || "pwp",
      summary: telegramSummary && telegramSummary.text,
      officialUrl: event.sourceUrl || event.url || prior.sourceUrl || null,
      context: {
        success: true,
        workflowId: stageInput.workflowId,
        queueReference: prior.editorialQueueReference.queue,
        manualReviewRequired: true
      },
      policy: {},
      transport,
      allowDelivery
    });

    return ok(
      {
        ...prior,
        telegramNotification: {
          delivery,
          summary: telegramSummary
        }
      },
      warnings,
      {
        stage: "TELEGRAM_NOTIFICATION",
        reused: "Telegram Notification service",
        delivered: Boolean(delivery && delivery.delivered)
      }
    );
  } catch (err) {
    return fail(
      [{ code: "TELEGRAM_ERROR", message: err.message || String(err) }],
      warnings,
      prior
    );
  }
}

function runReadyForReview(stageInput) {
  const prior = stageInput.currentPayload || {};
  const policy = assertAutoPublishDisabled();
  const warnings = [];

  if (!prior.editorialQueueReference || !prior.telegramNotification) {
    return fail(
      [
        {
          code: "NOT_READY",
          message: "READY_FOR_REVIEW requires editorial queue and telegram notification"
        }
      ],
      warnings,
      prior
    );
  }

  if (policy.autoPublishEnabled) {
    return fail(
      [
        {
          code: "AUTO_PUBLISH_ENABLED",
          message: "AUTO_PUBLISH_ENABLED must remain false"
        }
      ],
      warnings,
      prior
    );
  }

  return ok(
    {
      ...prior,
      readyForReview: true,
      publishingPolicy: policy,
      published: false,
      autoPublishBlocked: true
    },
    warnings,
    {
      stage: "READY_FOR_REVIEW",
      autoPublishBlocked: true,
      manualReviewRequired: true
    }
  );
}

function runManualPublishGate(stageInput) {
  const prior = stageInput.currentPayload || {};
  const event = (stageInput.workflowContext && stageInput.workflowContext.monitoringEvent) || {};
  const gate = evaluateManualPublishGate({
    confirmManualPublish: event.confirmManualPublish === true,
    readyForReview: prior.readyForReview === true
  });

  if (gate.state === "FAILED") {
    return fail(
      [{ code: "PUBLISH_POLICY_VIOLATION", message: gate.reason }],
      [],
      { ...prior, manualPublishGate: gate }
    );
  }

  if (!gate.allowed) {
    // Remain at READY_FOR_REVIEW — stage succeeds as a gate hold, not a publish.
    return ok(
      {
        ...prior,
        manualPublishGate: gate,
        published: false,
        autoPublishBlocked: true
      },
      [gate.reason],
      {
        stage: "MANUAL_PUBLISH_GATE",
        held: true,
        published: false,
        finalWorkflowState: "READY_FOR_REVIEW"
      }
    );
  }

  return ok(
    {
      ...prior,
      manualPublishGate: gate,
      published: false,
      markedPublishedManually: true,
      autoPublishBlocked: true
    },
    [],
    {
      stage: "MANUAL_PUBLISH_GATE",
      markedPublishedManually: true,
      publishingEngineInvoked: false,
      finalWorkflowState: "PUBLISHED_MANUALLY"
    }
  );
}

const STAGE_RUNNERS = Object.freeze({
  SOURCE_DETECTION: runSourceDetection,
  CHANGE_DETECTION: runChangeDetection,
  SOURCE_INTELLIGENCE_3A: runSourceIntelligence,
  CONTENT_EXTRACTION_3B_3C: runContentExtraction,
  MULTI_SOURCE_CORRELATION_3D: runMultiSourceCorrelation,
  EXTRACTION_QUALITY_3E: runExtractionQuality,
  RECRUITMENT_RESOLUTION: runRecruitmentResolution,
  DOCUMENT_INTELLIGENCE_P1: runDocumentIntelligence,
  AI_INTELLIGENCE_P2: runAiIntelligence,
  GENERATOR_DRAFT: runGeneratorDraft,
  EDITORIAL_QUEUE: runEditorialQueue,
  TELEGRAM_NOTIFICATION: runTelegramNotification,
  READY_FOR_REVIEW: runReadyForReview,
  MANUAL_PUBLISH_GATE: runManualPublishGate
});

module.exports = {
  STAGE_RUNNERS,
  runSourceDetection,
  runChangeDetection,
  runSourceIntelligence,
  runContentExtraction,
  runMultiSourceCorrelation,
  runExtractionQuality,
  runRecruitmentResolution,
  runDocumentIntelligence,
  runAiIntelligence,
  runGeneratorDraft,
  runEditorialQueue,
  runTelegramNotification,
  runReadyForReview,
  runManualPublishGate
};
