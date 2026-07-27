"use strict";

const {
  ENGINE_ID,
  STAGE_ID,
  ENGINE_VERSION,
  PROFILE_VERSION,
  SOURCE_PROFILE_FORMAT_ID,
  analyzeSource,
  analyzeSourceFromUrl,
  analyzeSourceFromPdf,
  analyzeSourceFromHtml,
  SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
  RELIABILITY_CLASSES,
  RELATIONSHIP_TYPES,
  EXTRACTION_STRATEGIES,
  CONFIDENCE_LEVELS,
  isKnownSourceType,
  getSourceTypeLabel,
  extractHostname,
  isOfficialHostSuffix,
  isKnownMirrorHost,
  REGISTRY_OFFICIAL_HOSTS,
  profileFingerprint,
  detectDocumentFormat,
  detectLanguages,
  assessReliability,
  recommendExtractionStrategy
} = require("../server/lib/contentIntelligence/sourceIntelligence");

const documentClassification = require("../server/lib/contentIntelligence/documentClassification");
const metadataIntelligence = require("../server/lib/contentIntelligence/metadataIntelligence");
const editorialDecisionSupport = require("../server/lib/contentIntelligence/editorialDecisionSupport");

describe("CIP Stage 3A — Shared Source Intelligence Engine", () => {
  test("engine metadata is stable", () => {
    expect(ENGINE_ID).toBe("CIP_SOURCE_INTELLIGENCE_ENGINE");
    expect(STAGE_ID).toBe("CIP_3A");
    expect(ENGINE_VERSION).toBe("1.0.0");
    expect(PROFILE_VERSION).toBe("1.0.0");
    expect(SOURCE_PROFILE_FORMAT_ID).toBe("cip_source_profile_v1");
  });

  test("taxonomy includes all required source types", () => {
    const required = [
      "official_html_page",
      "official_pdf",
      "linked_pdf",
      "corrigendum_pdf",
      "result_pdf",
      "admit_card_pdf",
      "answer_key_pdf",
      "notice_pdf",
      "unknown_source"
    ];
    expect([...SOURCE_TYPES]).toEqual(required);
    for (const type of required) {
      expect(SOURCE_TYPE_LABELS[type]).toBeTruthy();
      expect(isKnownSourceType(type)).toBe(true);
      expect(getSourceTypeLabel(type)).toBe(SOURCE_TYPE_LABELS[type]);
    }
  });

  test("returns structured Source Profile shape", () => {
    const profile = analyzeSource({
      url: "https://ssc.nic.in/Portal/Notice.pdf",
      title: "Important Notice",
      contentType: "application/pdf"
    });

    expect(profile).toEqual(
      expect.objectContaining({
        engineId: ENGINE_ID,
        stageId: STAGE_ID,
        identity: expect.objectContaining({
          sourceUrl: expect.any(String),
          sourceDomain: expect.any(String),
          candidateFileType: expect.any(String)
        }),
        classification: expect.objectContaining({
          sourceType: expect.any(String),
          sourceTypeLabel: expect.any(String),
          documentFormat: expect.any(String),
          primaryLanguage: expect.any(String),
          confidence: expect.any(String)
        }),
        reliability: expect.objectContaining({
          class: expect.any(String),
          confidence: expect.any(String),
          reasons: expect.any(Array),
          warnings: expect.any(Array)
        }),
        relationships: expect.objectContaining({
          role: expect.any(String),
          relatedTo: expect.any(String),
          relationshipType: expect.any(String),
          confidence: expect.any(String)
        }),
        capabilities: expect.objectContaining({
          downloadRequirement: expect.any(String),
          hasPdf: expect.any(Boolean),
          hasHtml: expect.any(Boolean),
          hasTables: expect.any(Boolean),
          hasForms: expect.any(Boolean),
          hasImages: expect.any(Boolean),
          likelyOcrRequired: expect.any(Boolean),
          likelyStructured: expect.any(Boolean),
          likelySemiStructured: expect.any(Boolean),
          likelyUnstructured: expect.any(Boolean)
        }),
        warnings: expect.any(Array),
        recommendedExtractionStrategy: expect.objectContaining({
          strategy: expect.any(String),
          strategyLabel: expect.any(String),
          reasons: expect.any(Array)
        })
      })
    );
    expect(Object.isFrozen(profile)).toBe(true);
  });

  describe("supported source types", () => {
    test("Official HTML page", () => {
      const profile = analyzeSourceFromHtml({
        url: "https://www.upsc.gov.in/examinations",
        title: "UPSC Examinations"
      });
      expect(profile.classification.sourceType).toBe("official_html_page");
      expect(profile.classification.documentFormat).toBe("html");
      expect(profile.reliability.class).toBe(RELIABILITY_CLASSES.OFFICIAL);
      expect(profile.capabilities.hasHtml).toBe(true);
      expect(profile.recommendedExtractionStrategy.strategy).toBe(
        EXTRACTION_STRATEGIES.HTML_FIRST
      );
    });

    test("Official PDF", () => {
      const profile = analyzeSourceFromPdf({
        url: "https://ssc.nic.in/SSC_CGL_Notification_2026.pdf",
        title: "SSC CGL Recruitment Notification",
        filename: "SSC_CGL_Notification_2026.pdf"
      });
      expect(profile.classification.sourceType).toBe("official_pdf");
      expect(profile.classification.documentFormat).toBe("pdf");
      expect(profile.reliability.class).toBe(RELIABILITY_CLASSES.OFFICIAL);
      expect(profile.capabilities.hasPdf).toBe(true);
      expect(profile.capabilities.downloadRequirement).toBe("required");
      expect(profile.recommendedExtractionStrategy.strategy).toBe(
        EXTRACTION_STRATEGIES.PDF_FIRST
      );
    });

    test("Linked PDF", () => {
      const profile = analyzeSource({
        url: "https://ssc.nic.in/files/advt.pdf",
        filename: "advt.pdf",
        contentType: "application/pdf",
        linkedFromUrl: "https://ssc.nic.in/Portal/Apply",
        title: "Advertisement Attachment"
      });
      expect(profile.classification.sourceType).toBe("linked_pdf");
      expect(profile.capabilities.hasPdf).toBe(true);
      expect(profile.capabilities.hasHtml).toBe(true);
      expect(profile.recommendedExtractionStrategy.strategy).toBe(
        EXTRACTION_STRATEGIES.HTML_PLUS_PDF
      );
    });

    test("Result PDF", () => {
      const profile = analyzeSourceFromPdf({
        url: "https://ssc.nic.in/Portal/Results/tier1-result.pdf",
        title: "Tier 1 Result Declared",
        filename: "tier1-result.pdf"
      });
      expect(profile.classification.sourceType).toBe("result_pdf");
      expect(profile.relationships.relationshipType).toBe(
        RELATIONSHIP_TYPES.NOTIFICATION_TO_RESULT
      );
      expect(profile.relationships.relatedTo).toBe("notification");
    });

    test("Admit Card PDF", () => {
      const profile = analyzeSourceFromPdf({
        url: "https://www.upsc.gov.in/admit-card.pdf",
        title: "Download Admit Card",
        filename: "admit-card.pdf"
      });
      expect(profile.classification.sourceType).toBe("admit_card_pdf");
      expect(profile.relationships.relationshipType).toBe(
        RELATIONSHIP_TYPES.NOTIFICATION_TO_ADMIT_CARD
      );
    });

    test("Answer Key PDF", () => {
      const profile = analyzeSourceFromPdf({
        url: "https://nta.ac.in/answer-key.pdf",
        title: "Provisional Answer Key",
        filename: "answer-key.pdf"
      });
      expect(profile.classification.sourceType).toBe("answer_key_pdf");
      expect(profile.relationships.relationshipType).toBe(
        RELATIONSHIP_TYPES.NOTIFICATION_TO_ANSWER_KEY
      );
    });

    test("Corrigendum PDF", () => {
      const profile = analyzeSourceFromPdf({
        url: "https://ssc.nic.in/corrigendum-cgl.pdf",
        title: "Corrigendum to Notification No. 03/2026",
        filename: "corrigendum-cgl.pdf",
        parentNotificationUrl: "https://ssc.nic.in/notification-cgl.pdf"
      });
      expect(profile.classification.sourceType).toBe("corrigendum_pdf");
      expect(profile.relationships.role).toBe("corrigendum");
      expect(profile.relationships.relationshipType).toBe(
        RELATIONSHIP_TYPES.NOTIFICATION_TO_CORRIGENDUM
      );
      expect(profile.relationships.confidence).toBe("high");
      expect(profile.relationships.parentIndicators.length).toBeGreaterThan(0);
    });

    test("Notice PDF", () => {
      const profile = analyzeSourceFromPdf({
        url: "https://www.rrbcdg.gov.in/important-notice.pdf",
        title: "Important Notice for Candidates",
        filename: "important-notice.pdf"
      });
      expect(profile.classification.sourceType).toBe("notice_pdf");
      expect(profile.relationships.relationshipType).toBe(
        RELATIONSHIP_TYPES.NOTIFICATION_TO_NOTICE
      );
    });

    test("Unknown source", () => {
      const profile = analyzeSource({
        title: "Some file"
      });
      expect(profile.classification.sourceType).toBe("unknown_source");
      expect(profile.reliability.class).toBe(RELIABILITY_CLASSES.UNKNOWN);
      expect(profile.recommendedExtractionStrategy.strategy).toBe(
        EXTRACTION_STRATEGIES.MANUAL_REVIEW_RECOMMENDED
      );
    });
  });

  describe("mirror source", () => {
    test("classifies known mirror host as mirror_source", () => {
      const profile = analyzeSource({
        url: "https://www.sarkariresult.com/ssc/cgl-result/",
        title: "SSC CGL Result",
        documentFormat: "html"
      });
      expect(profile.reliability.class).toBe(RELIABILITY_CLASSES.MIRROR);
      expect(profile.reliability.confidence).toBe("high");
      expect(profile.reliability.warnings.length).toBeGreaterThan(0);
      expect(profile.recommendedExtractionStrategy.strategy).toBe(
        EXTRACTION_STRATEGIES.MANUAL_REVIEW_RECOMMENDED
      );
    });

    test("does not guess unknown commercial domains as mirror", () => {
      const profile = analyzeSource({
        url: "https://example-news-site.example/jobs",
        documentFormat: "html",
        title: "Jobs"
      });
      expect(profile.reliability.class).toBe(RELIABILITY_CLASSES.UNKNOWN);
      expect(isKnownMirrorHost(profile.identity.sourceDomain)).toBe(false);
    });
  });

  describe("reliability model", () => {
    test("gov.in and nic.in are official", () => {
      expect(isOfficialHostSuffix("upsc.gov.in")).toBe(true);
      expect(isOfficialHostSuffix("ssc.nic.in")).toBe(true);
      const a = assessReliability({}, "ssc.nic.in");
      expect(a.class).toBe(RELIABILITY_CLASSES.OFFICIAL);
      expect(a.confidence).toBe("high");
    });

    test("registry hosts are official", () => {
      expect(REGISTRY_OFFICIAL_HOSTS.length).toBeGreaterThan(0);
      const profile = analyzeSourceFromUrl("https://www.ibps.in/html/cand_app.htm", {
        documentFormat: "html",
        title: "IBPS Apply"
      });
      expect(profile.reliability.class).toBe(RELIABILITY_CLASSES.OFFICIAL);
    });

    test("never promotes declared-official without domain evidence", () => {
      const profile = analyzeSource({
        url: "https://random-blog.example/page",
        documentFormat: "html",
        reliabilityHint: "official_source"
      });
      expect(profile.reliability.class).toBe(RELIABILITY_CLASSES.UNKNOWN);
      expect(profile.reliability.warnings.some((w) => /ignored/i.test(w))).toBe(true);
    });
  });

  describe("relationship detection", () => {
    test("detects notification → corrigendum", () => {
      const profile = analyzeSourceFromPdf({
        filename: "corrigendum.pdf",
        title: "Corrigendum",
        url: "https://ssc.nic.in/corrigendum.pdf",
        notificationUrl: "https://ssc.nic.in/notification.pdf"
      });
      expect(profile.relationships.relationshipType).toBe(
        RELATIONSHIP_TYPES.NOTIFICATION_TO_CORRIGENDUM
      );
    });

    test("detects notification → admit card / result / answer key / notice", () => {
      const cases = [
        ["Admit Card PDF", "admit_card.pdf", RELATIONSHIP_TYPES.NOTIFICATION_TO_ADMIT_CARD],
        ["Final Result", "result.pdf", RELATIONSHIP_TYPES.NOTIFICATION_TO_RESULT],
        ["Answer Key", "answer-key.pdf", RELATIONSHIP_TYPES.NOTIFICATION_TO_ANSWER_KEY],
        ["Public Notice", "public-notice.pdf", RELATIONSHIP_TYPES.NOTIFICATION_TO_NOTICE]
      ];
      for (const [title, filename, rel] of cases) {
        const profile = analyzeSourceFromPdf({
          url: `https://ssc.nic.in/${filename}`,
          title,
          filename
        });
        expect(profile.relationships.relationshipType).toBe(rel);
        expect(profile.relationships.relatedTo).toBe("notification");
      }
    });

    test("does not invent relationships for plain official notification", () => {
      const profile = analyzeSourceFromPdf({
        url: "https://ssc.nic.in/recruitment-notification.pdf",
        title: "Recruitment Notification",
        filename: "recruitment-notification.pdf"
      });
      expect(profile.classification.sourceType).toBe("official_pdf");
      expect(profile.relationships.role).toBe("notification");
      expect(profile.relationships.relationshipType).toBeNull();
      expect(profile.relationships.relatedTo).toBeNull();
    });
  });

  describe("extraction strategy model", () => {
    test("HTML First", () => {
      const strategy = recommendExtractionStrategy({
        capabilities: { hasHtml: true, hasPdf: false, likelyOcrRequired: false },
        reliability: { class: RELIABILITY_CLASSES.OFFICIAL },
        sourceType: "official_html_page",
        documentFormat: "html"
      });
      expect(strategy.strategy).toBe(EXTRACTION_STRATEGIES.HTML_FIRST);
    });

    test("PDF First", () => {
      const strategy = recommendExtractionStrategy({
        capabilities: { hasHtml: false, hasPdf: true, likelyOcrRequired: false },
        reliability: { class: RELIABILITY_CLASSES.OFFICIAL },
        sourceType: "official_pdf",
        documentFormat: "pdf"
      });
      expect(strategy.strategy).toBe(EXTRACTION_STRATEGIES.PDF_FIRST);
    });

    test("HTML + PDF", () => {
      const strategy = recommendExtractionStrategy({
        capabilities: { hasHtml: true, hasPdf: true, likelyOcrRequired: false },
        reliability: { class: RELIABILITY_CLASSES.OFFICIAL },
        sourceType: "linked_pdf",
        documentFormat: "pdf"
      });
      expect(strategy.strategy).toBe(EXTRACTION_STRATEGIES.HTML_PLUS_PDF);
    });

    test("OCR Required", () => {
      const profile = analyzeSourceFromPdf({
        url: "https://ssc.nic.in/scanned.pdf",
        title: "Scanned Notification",
        isScanned: true
      });
      expect(profile.capabilities.likelyOcrRequired).toBe(true);
      expect(profile.recommendedExtractionStrategy.strategy).toBe(
        EXTRACTION_STRATEGIES.OCR_REQUIRED
      );
    });

    test("Manual Review Recommended for unknown", () => {
      const profile = analyzeSource({ title: "???" });
      expect(profile.recommendedExtractionStrategy.strategy).toBe(
        EXTRACTION_STRATEGIES.MANUAL_REVIEW_RECOMMENDED
      );
    });
  });

  describe("language and capabilities", () => {
    test("detects English primary language", () => {
      const langs = detectLanguages("Staff Selection Commission Recruitment Notification");
      expect(langs.primaryLanguage).toBe("en");
      expect(langs.secondaryLanguage).toBeNull();
    });

    test("detects Hindi and bilingual", () => {
      const hi = detectLanguages("कर्मचारी चयन आयोग");
      expect(hi.primaryLanguage).toBe("hi");
      const mixed = detectLanguages("SSC कर्मचारी चयन आयोग Recruitment");
      expect(["en", "hi"]).toContain(mixed.primaryLanguage);
      expect(mixed.secondaryLanguage).not.toBeNull();
    });

    test("format detection from content type and filename", () => {
      expect(detectDocumentFormat({ contentType: "application/pdf" }).documentFormat).toBe("pdf");
      expect(detectDocumentFormat({ contentType: "text/html" }).documentFormat).toBe("html");
      expect(detectDocumentFormat({ filename: "notice.PDF" }).documentFormat).toBe("pdf");
      expect(detectDocumentFormat({ url: "https://x.example/a.htm" }).documentFormat).toBe("html");
    });

    test("structured vs unstructured hints", () => {
      const structured = analyzeSourceFromHtml({
        url: "https://ssc.nic.in/apply",
        hasTables: true,
        hasForms: true
      });
      expect(structured.capabilities.likelyStructured).toBe(true);

      const unstructured = analyzeSourceFromPdf({
        url: "https://ssc.nic.in/scan.pdf",
        isScanned: true,
        hasImages: true,
        textSelectable: false
      });
      expect(unstructured.capabilities.likelyUnstructured).toBe(true);
      expect(unstructured.capabilities.likelyOcrRequired).toBe(true);
    });
  });

  describe("determinism", () => {
    test("identical inputs produce identical profiles", () => {
      const input = {
        url: "https://ssc.nic.in/Portal/Results/result.pdf",
        title: "Final Result",
        filename: "result.pdf",
        contentType: "application/pdf",
        hasTables: true
      };
      const a = analyzeSource(input);
      const b = analyzeSource(input);
      expect(profileFingerprint(a)).toBe(profileFingerprint(b));
      expect(a.classification.sourceType).toBe("result_pdf");
      expect(CONFIDENCE_LEVELS).toContain(a.classification.confidence);
    });

    test("hostname extraction is stable", () => {
      expect(extractHostname("https://www.SSC.NIC.IN/path")).toBe("ssc.nic.in");
      expect(extractHostname("ssc.nic.in")).toBe("ssc.nic.in");
    });
  });

  describe("backward compatibility", () => {
    test("does not alter Program 1 document classification exports", () => {
      expect(documentClassification.STAGE_ID).toBe("CIP_1A");
      expect(documentClassification.ENGINE_ID).toBe("CIP_DOCUMENT_CLASSIFICATION_ENGINE");
      const classified = documentClassification.classifyDocument({
        title: "Admit Card Download"
      });
      expect(classified.documentType).toBe("admit_card");
    });

    test("does not alter Program 1 metadata intelligence stage id", () => {
      expect(metadataIntelligence.STAGE_ID).toBe("CIP_1B");
    });

    test("does not alter Program 2 editorial decision support stage id", () => {
      expect(editorialDecisionSupport.STAGE_ID).toBe("CIP_2E");
      expect(editorialDecisionSupport.ENGINE_ID).toBe(
        "CIP_EDITORIAL_DECISION_SUPPORT_ENGINE"
      );
    });

    test("Stage 3A module is additive and self-contained", () => {
      expect(STAGE_ID).toBe("CIP_3A");
      expect(documentClassification.STAGE_ID).not.toBe("CIP_3A");
      expect(editorialDecisionSupport.STAGE_ID).not.toBe("CIP_3A");
    });
  });
});
