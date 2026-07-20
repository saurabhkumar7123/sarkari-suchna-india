"use strict";

/**
 * Package 4F — Feature Completion Report (product copy, advisory).
 *
 * Consolidates Program 4 package status, remaining gaps, capability summary,
 * and Program 5 readiness recommendation. Does NOT authorize deployment.
 */

const PACKAGE_STATUSES = Object.freeze({
  "4A": {
    packageCode: "4A",
    packageId: "PACKAGE_4A_FEATURE_COMPLETION_BASELINE_AND_DEFINITION_OF_DONE",
    name: "Feature Completion Baseline",
    status: "COMPLETE"
  },
  "4B": {
    packageCode: "4B",
    packageId: "PACKAGE_4B_RECRUITMENT_ADMIN_CRUD",
    name: "Recruitment Operations",
    status: "COMPLETE"
  },
  "4C": {
    packageCode: "4C",
    packageId: "PACKAGE_4C_GENERATOR_BINDING_AND_EDITORIAL_REVIEW",
    name: "Generator Binding & Editorial Review",
    status: "COMPLETE"
  },
  "4D": {
    packageCode: "4D",
    packageId: "PACKAGE_4D_SHARED_RUNTIME_PREVIEW",
    name: "Shared Runtime Preview",
    status: "COMPLETE"
  },
  "4E": {
    packageCode: "4E",
    packageId: "PACKAGE_4E_ADMIN_PRODUCTIVITY",
    name: "Admin Productivity & Stub Closure",
    status: "COMPLETE"
  },
  "4F": {
    packageCode: "4F",
    packageId: "PACKAGE_4F_SEO_HUB_AND_CONTENT_PIPELINE_POLISH",
    name: "SEO & Content Pipeline Completion",
    status: "COMPLETE"
  }
});

/**
 * @param {object} [overrides]
 */
function generateFeatureCompletionReport(overrides = {}) {
  const packages = { ...PACKAGE_STATUSES, ...(overrides.packages || {}) };
  const completedPackages = Object.values(packages).filter((p) => p.status === "COMPLETE");
  const incompletePackages = Object.values(packages).filter((p) => p.status !== "COMPLETE");

  const remainingGaps = Array.isArray(overrides.remainingGaps)
    ? overrides.remainingGaps
    : [
        {
          gapId: "GAP_PROGRAM_5_AUTOMATION_WIRING",
          priority: "MUST_HAVE",
          status: "OPEN",
          note: "Program 5 automation / monitoring wiring remains out of Program 4 scope."
        },
        {
          gapId: "GAP_DEPLOYMENT_AUTHORIZATION",
          priority: "FUTURE",
          status: "LOCKED",
          note: "Deployment remains unauthorized until explicitly authorized outside Program 4."
        }
      ];

  const capabilitySummary = overrides.capabilitySummary || {
    recruitmentOperations: "COMPLETE",
    editorialReview: "COMPLETE",
    sharedPreview: "COMPLETE",
    adminProductivity: "COMPLETE",
    seoHubSitemap: "COMPLETE",
    contentPipelineValidation: "COMPLETE",
    editorialChecklist: "COMPLETE",
    internalLinkingAssistant: "COMPLETE",
    contentFreshness: "COMPLETE",
    seoDiagnostics: "COMPLETE",
    automation: "LOCKED",
    monitoring: "LOCKED",
    deployment: "UNAUTHORIZED"
  };

  const program4Complete = incompletePackages.length === 0;
  const program5Recommendation = {
    mayPlan: true,
    mayStart: false,
    locked: true,
    recommendation: program4Complete
      ? "Program 4 is complete. Program 5 may be recommended for planning only and remains locked until explicitly authorized."
      : "Complete remaining Program 4 packages before recommending Program 5 planning.",
    deploymentAuthorized: false,
    productionAuthorized: false,
    note: "This report is advisory only. It must NOT authorize deployment."
  };

  return {
    reportId: "FEATURE_COMPLETION_REPORT_PROGRAM_4",
    packageId: "PACKAGE_4F_SEO_HUB_AND_CONTENT_PIPELINE_POLISH",
    advisory: true,
    authorizesDeployment: false,
    authorizesProgram5: false,
    generatedAt: (overrides.now ? new Date(overrides.now) : new Date()).toISOString(),
    program: "PROGRAM_4_PRODUCT_FEATURE_CLOSURE",
    completedPackages,
    incompletePackages,
    remainingGaps,
    capabilitySummary,
    program4: {
      complete: program4Complete,
      packagesTotal: Object.keys(packages).length,
      packagesComplete: completedPackages.length
    },
    program5ReadinessRecommendation: program5Recommendation,
    verdict: program4Complete
      ? "PROGRAM_4_FEATURE_COMPLETE_ADVISORY"
      : "PROGRAM_4_INCOMPLETE",
    disclaimer:
      "Advisory Feature Completion Report only. Deployment remains unauthorized. Program 5 remains locked until explicitly authorized."
  };
}

module.exports = {
  PACKAGE_STATUSES,
  generateFeatureCompletionReport
};
