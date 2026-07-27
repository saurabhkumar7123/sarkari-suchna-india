'use strict';

/**
 * PROGRAM 4 — Package 4A
 * Feature Completion Baseline & Definition of Done Framework
 * (Advisory / Governance Only)
 *
 * Official Feature Completion Baseline for Sarkari Suchna India.
 * Freezes what "100% Feature Complete" means and establishes the
 * single source of truth for remaining Program 4 work.
 *
 * Deep frozen. Deterministic. Version 1.0.0.
 *
 * Pure advisory framework.
 * No runtime integration. No feature activation. No SQL.
 * No database changes. No APIs. No routes. No scheduler.
 * No worker. No publishing. No GitHub. No deployment.
 * No production changes. No Program 4 feature implementation.
 * Program 5 must NOT automatically start.
 *
 * Functions:
 *   getFeatureCompletionBaselineFramework()
 *   getFeatureCompletionBaselineFrameworkIdentity()
 *   getCurrentProjectState()
 *   getDefinitionOfDone()
 *   getCapabilityCategories()
 *   getGapClassification()
 *   getProgram4Scope()
 *   getCompletionGates()
 *   getRiskAssessment()
 *   getRoadmapSummary()
 */

const FRAMEWORK_VERSION = '1.0.0';

const PROGRAM_ID = 'PROGRAM_4_PRODUCT_FEATURE_CLOSURE';
const PACKAGE_ID =
  'PACKAGE_4A_FEATURE_COMPLETION_BASELINE_AND_DEFINITION_OF_DONE';
const PACKAGE_NAME =
  'Feature Completion Baseline & Definition of Done Framework';

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

const GAP_PRIORITIES = Object.freeze([
  'MUST_HAVE',
  'SHOULD_HAVE',
  'NICE_TO_HAVE',
  'FUTURE',
]);

const INDEPENDENT_STATES = Object.freeze([
  'ARCHITECTURE_COMPLETE',
  'IMPLEMENTATION_COMPLETE',
  'FEATURE_COMPLETE',
  'DEPLOYMENT_READY',
  'PRODUCTION_READY',
]);

const CAPABILITY_CATEGORY_IDS = Object.freeze([
  'CORE_PLATFORM',
  'CMS',
  'GENERATOR',
  'RECRUITMENT',
  'ADMIN',
  'AUTOMATION',
  'MONITORING',
  'SEO',
  'ANALYTICS',
  'SECURITY',
  'PERFORMANCE',
  'DEVELOPER_EXPERIENCE',
  'TESTING',
  'DOCUMENTATION',
  'INFRASTRUCTURE',
  'OPERATIONS',
]);

const PROGRAM_4_PACKAGE_IDS = Object.freeze([
  '4A',
  '4B',
  '4C',
  '4D',
  '4E',
  '4F',
]);

const CURRENT_PROJECT_STATE = deepFreeze({
  stateIdentity: 'STATE_CURRENT_PROJECT',
  completedPrograms: [
    {
      programId: 'PROGRAM_1_IMPLEMENTATION_AUTHORITY_AND_PROJECT_FREEZE',
      shortName: 'Program 1',
      status: 'COMPLETE',
    },
    {
      programId: 'PROGRAM_2_DATABASE_FOUNDATION',
      shortName: 'Program 2',
      status: 'COMPLETE',
    },
    {
      programId: 'PROGRAM_3_CONTROLLED_DATABASE_IMPLEMENTATION',
      shortName: 'Program 3',
      status: 'COMPLETE',
    },
  ],
  localImplementation: {
    trackId: 'LOCAL_IMPLEMENTATION_TRACK',
    status: 'COMPLETE',
    phases: ['LI2-01', 'LI2-02', 'LI2-03', 'LI2-04', 'LI2-05'],
  },
  localReleaseCertification: {
    certificationStatus: 'LOCAL_RELEASE_CERTIFIED',
    status: 'COMPLETE',
    deploymentAuthorized: false,
    productionAuthorized: false,
  },
  currentMilestone: {
    milestoneId: 'MILESTONE_PROGRAM_4_FEATURE_COMPLETION_BASELINE',
    milestoneName: 'Feature Completion Baseline Freeze',
    program: PROGRAM_ID,
    package: PACKAGE_ID,
    packageCode: '4A',
    status: 'IN_PROGRESS',
  },
  currentRuntimeReadiness: {
    readinessIdentity: 'READINESS_RUNTIME_CURRENT',
    localRuntimeCertified: true,
    localReleaseCertified: true,
    architectureFrozen: true,
    databaseFoundationCertified: true,
    runtimeActivatedForFeatureWork: false,
    deploymentAuthorized: false,
    productionAuthorized: false,
    githubAuthorized: false,
    vpsAuthorized: false,
    verdict: 'LOCAL_FOUNDATION_READY_FEATURE_COMPLETION_NOT_STARTED',
  },
  currentFeatureReadiness: {
    readinessIdentity: 'READINESS_FEATURE_CURRENT',
    featureComplete: false,
    featureCompletionPercent: 70,
    manualPortalMaturityPercent: 90,
    recruitmentAutomationMaturityPercent: 40,
    platformHardeningMaturityPercent: 55,
    overallBand: '68-72',
    featureCompleteClaimAllowed: false,
    blockingTrack: 'PROGRAM_4_THEN_PROGRAM_5',
    verdict: 'FEATURE_COMPLETION_BASELINE_REQUIRED',
  },
  independentStateSnapshot: {
    ARCHITECTURE_COMPLETE: true,
    IMPLEMENTATION_COMPLETE: true,
    FEATURE_COMPLETE: false,
    DEPLOYMENT_READY: false,
    PRODUCTION_READY: false,
  },
  deploymentStatus: {
    deploymentAuthorized: false,
    productionAuthorized: false,
    note: 'Deployment is NOT authorized. This package is NOT about deployment.',
  },
});

const DEFINITION_OF_DONE = deepFreeze({
  dodIdentity: 'DOD_FEATURE_COMPLETION_PROGRAM_4',
  purpose:
    'Define the official conditions required before Sarkari Suchna India may be considered FEATURE_COMPLETE.',
  singleSourceOfTruth: true,
  targetState: 'FEATURE_COMPLETE',
  independentStates: {
    statesIdentity: 'STATES_INDEPENDENT_COMPLETION',
    separationRequired: true,
    states: {
      ARCHITECTURE_COMPLETE: {
        stateId: 'ARCHITECTURE_COMPLETE',
        meaning:
          'Architecture blueprints, freezes, and Stage 12 / Phase 529 baseline are closed.',
        currentStatus: 'ACHIEVED',
        impliesFeatureComplete: false,
        impliesDeploymentReady: false,
        impliesProductionReady: false,
      },
      IMPLEMENTATION_COMPLETE: {
        stateId: 'IMPLEMENTATION_COMPLETE',
        meaning:
          'Programs 1–3 and local implementation/certification tracks for foundation work are complete.',
        currentStatus: 'ACHIEVED',
        impliesFeatureComplete: false,
        impliesDeploymentReady: false,
        impliesProductionReady: false,
      },
      FEATURE_COMPLETE: {
        stateId: 'FEATURE_COMPLETE',
        meaning:
          'Product meets the frozen Feature Completion Baseline: competitive manual portal plus operable recruitment MVP (human-in-the-loop), with automation gated but wired where required by Must Have scope.',
        currentStatus: 'NOT_ACHIEVED',
        impliesDeploymentReady: false,
        impliesProductionReady: false,
        requiresProgram4Complete: true,
        requiresProgram5MustHaveComplete: true,
      },
      DEPLOYMENT_READY: {
        stateId: 'DEPLOYMENT_READY',
        meaning:
          'Explicit deployment program gates have passed. Feature Complete alone does not grant this state.',
        currentStatus: 'NOT_ACHIEVED',
        authorizedByThisFramework: false,
        requiresSeparateAuthorization: true,
      },
      PRODUCTION_READY: {
        stateId: 'PRODUCTION_READY',
        meaning:
          'Production go-live authorization has been granted by a future production program.',
        currentStatus: 'NOT_ACHIEVED',
        authorizedByThisFramework: false,
        requiresSeparateAuthorization: true,
      },
    },
    rules: [
      'ARCHITECTURE_COMPLETE_DOES_NOT_MEAN_FEATURE_COMPLETE',
      'IMPLEMENTATION_COMPLETE_DOES_NOT_MEAN_FEATURE_COMPLETE',
      'FEATURE_COMPLETE_DOES_NOT_MEAN_DEPLOYMENT_READY',
      'DEPLOYMENT_READY_DOES_NOT_MEAN_PRODUCTION_READY',
      'STATES_ARE_INDEPENDENT_AND_MUST_NOT_BE_COLLAPSED',
    ],
  },
  featureCompleteConditions: {
    conditionsIdentity: 'CONDITIONS_FEATURE_COMPLETE',
    allRequired: true,
    conditions: [
      {
        conditionId: 'FC_01_PROGRAM_4_PACKAGES_COMPLETE',
        description:
          'All Program 4 packages 4A–4F meet their package Completion Criteria.',
        priority: 'MUST_HAVE',
        satisfied: false,
      },
      {
        conditionId: 'FC_02_RECRUITMENT_ADMIN_OPS_USABLE',
        description:
          'Recruitment admin CRUD, binding, and review-queue ops workflow are usable without API clients.',
        priority: 'MUST_HAVE',
        satisfied: false,
      },
      {
        conditionId: 'FC_03_MANUAL_PORTAL_BASELINE_INTACT',
        description:
          'Manual Sarkari CMS / public portal baseline remains complete and regression-safe.',
        priority: 'MUST_HAVE',
        satisfied: false,
      },
      {
        conditionId: 'FC_04_ADMIN_STUBS_RESOLVED',
        description:
          'Admin stubs (bulk regenerate, Live Visitors, and equivalent) are implemented or intentionally removed.',
        priority: 'MUST_HAVE',
        satisfied: false,
      },
      {
        conditionId: 'FC_05_SEO_HUB_COVERAGE',
        description:
          'SEO hub sitemap coverage and content-pipeline polish for Program 4 scope are complete.',
        priority: 'MUST_HAVE',
        satisfied: false,
      },
      {
        conditionId: 'FC_06_SHARED_PREVIEW_STORE',
        description:
          'Shared preview store closes process-local preview gaps for web/worker processes.',
        priority: 'MUST_HAVE',
        satisfied: false,
      },
      {
        conditionId: 'FC_07_MUST_HAVE_GAPS_CLOSED_OR_DEFERRED',
        description:
          'Every Must Have gap is closed, or explicitly deferred only with a Program 5 successor package recorded in the baseline.',
        priority: 'MUST_HAVE',
        satisfied: false,
      },
      {
        conditionId: 'FC_08_NO_UNGATED_AUTO_PUBLISH',
        description:
          'No ungated auto-publish path exists; human-in-the-loop remains enforced for publish.',
        priority: 'MUST_HAVE',
        satisfied: false,
      },
      {
        conditionId: 'FC_09_FEATURE_COMPLETE_CERTIFICATION',
        description:
          'A later Program 4 completion certification package records FEATURE_COMPLETE = true against this baseline.',
        priority: 'MUST_HAVE',
        satisfied: false,
      },
    ],
    nonConditions: [
      'LOCAL_RELEASE_CERTIFIED_ALONE',
      'ARCHITECTURE_COMPLETE_ALONE',
      'IMPLEMENTATION_COMPLETE_ALONE',
      'DEPLOYMENT_AUTHORIZATION',
      'PRODUCTION_GO_LIVE',
      'GITHUB_OR_VPS_PRESENCE',
    ],
  },
  completionMeaning: {
    meaningIdentity: 'MEANING_100_PERCENT_FEATURE_COMPLETE',
    definition:
      '100% Feature Complete means the frozen Must Have product scope for portal + recruitment MVP (human-in-the-loop) is delivered against this baseline. It does not mean Deployment Ready or Production Ready.',
    includes: [
      'COMPETITIVE_MANUAL_PORTAL',
      'OPERABLE_RECRUITMENT_MVP_HUMAN_IN_THE_LOOP',
      'PROGRAM_4_PACKAGE_CLOSURE',
      'MUST_HAVE_GAPS_ADDRESSED_PER_BASELINE',
    ],
    excludes: [
      'VPS_DEPLOYMENT',
      'GITHUB_REMOTE_RELEASE',
      'PUBLIC_PRODUCTION_LAUNCH',
      'UNGATED_FULL_AUTO_PUBLISH',
      'FUTURE_IDEAS_SCOPE',
    ],
  },
});

const CAPABILITY_CATEGORIES = deepFreeze({
  categoriesIdentity: 'CATEGORIES_FEATURE_CAPABILITY',
  categoryOrder: CAPABILITY_CATEGORY_IDS.slice(),
  categories: [
    {
      categoryId: 'CORE_PLATFORM',
      categoryName: 'Core Platform',
      completionStatus: 'NEAR_COMPLETE',
      completionPercent: 90,
      priority: 'MUST_HAVE',
      blockingIssues: [],
      remainingWork: [
        'Protect portal regressions during Program 4 feature work',
        'Keep health/ready and auth baseline intact',
      ],
      dependencies: [],
    },
    {
      categoryId: 'CMS',
      categoryName: 'CMS',
      completionStatus: 'NEAR_COMPLETE',
      completionPercent: 90,
      priority: 'MUST_HAVE',
      blockingIssues: [],
      remainingWork: [
        'Bulk regenerate capability or explicit stub removal',
        'CMS lifecycle integration test coverage expansion',
      ],
      dependencies: ['CORE_PLATFORM'],
    },
    {
      categoryId: 'GENERATOR',
      categoryName: 'Generator',
      completionStatus: 'PARTIAL',
      completionPercent: 75,
      priority: 'MUST_HAVE',
      blockingIssues: [
        'Draft ↔ recruitment binding UX incomplete',
      ],
      remainingWork: [
        'Generator to recruitment binding UX',
        'Approval gate in admin workflow',
      ],
      dependencies: ['CMS', 'RECRUITMENT', 'ADMIN'],
    },
    {
      categoryId: 'RECRUITMENT',
      categoryName: 'Recruitment',
      completionStatus: 'PARTIAL',
      completionPercent: 55,
      priority: 'MUST_HAVE',
      blockingIssues: [
        'Admin CRUD UI missing for recruitments/events/page links',
        'Review queue not primary ops inbox',
        'Shared preview store not implemented',
      ],
      remainingWork: [
        'Recruitment Admin CRUD UI',
        'Events and page-link management UI',
        'Review-queue ops workflow',
        'Shared preview store',
      ],
      dependencies: ['CORE_PLATFORM', 'ADMIN'],
    },
    {
      categoryId: 'ADMIN',
      categoryName: 'Admin',
      completionStatus: 'PARTIAL',
      completionPercent: 70,
      priority: 'MUST_HAVE',
      blockingIssues: [
        'Recruitment manager screens absent',
        'Live Visitors stub unresolved',
      ],
      remainingWork: [
        'Recruitment Manager UI',
        'Resolve admin stubs',
        'Unified inbox shortcuts',
      ],
      dependencies: ['CMS', 'RECRUITMENT'],
    },
    {
      categoryId: 'AUTOMATION',
      categoryName: 'Automation',
      completionStatus: 'PARTIAL',
      completionPercent: 40,
      priority: 'MUST_HAVE',
      blockingIssues: [
        'Monitor → review persistence remains observational',
        'Controlled automation wiring deferred to Program 5',
      ],
      remainingWork: [
        'Program 4 prepares ops surfaces for safe wiring',
        'Program 5 flag-gated pipeline persistence',
      ],
      dependencies: ['RECRUITMENT', 'MONITORING'],
    },
    {
      categoryId: 'MONITORING',
      categoryName: 'Monitoring',
      completionStatus: 'PARTIAL',
      completionPercent: 65,
      priority: 'MUST_HAVE',
      blockingIssues: [
        'Pipeline stage health checkpoints incomplete for feature-complete claim',
      ],
      remainingWork: [
        'Pipeline health surfaces for ops',
        'Alert threshold clarity for recruitment stages',
      ],
      dependencies: ['CORE_PLATFORM', 'AUTOMATION'],
    },
    {
      categoryId: 'SEO',
      categoryName: 'SEO',
      completionStatus: 'PARTIAL',
      completionPercent: 80,
      priority: 'MUST_HAVE',
      blockingIssues: [
        'Hub URLs incomplete in sitemap coverage',
      ],
      remainingWork: [
        'Qualification/state/topic hub sitemap coverage',
        'Content-pipeline polish in Package 4F',
      ],
      dependencies: ['CMS', 'GENERATOR'],
    },
    {
      categoryId: 'ANALYTICS',
      categoryName: 'Analytics',
      completionStatus: 'PARTIAL',
      completionPercent: 50,
      priority: 'NICE_TO_HAVE',
      blockingIssues: [
        'Live Visitors marked Coming soon',
      ],
      remainingWork: [
        'Implement Live Visitors or remove stub',
        'Defer richer product analytics to later programs',
      ],
      dependencies: ['ADMIN'],
    },
    {
      categoryId: 'SECURITY',
      categoryName: 'Security',
      completionStatus: 'PARTIAL',
      completionPercent: 70,
      priority: 'SHOULD_HAVE',
      blockingIssues: [
        'Multi-admin RBAC not in Program 4 Must Have scope',
      ],
      remainingWork: [
        'Preserve JWT/CSRF/Helmet/rate-limit baseline',
        'RBAC hardening tracked under Program 6',
      ],
      dependencies: ['CORE_PLATFORM', 'ADMIN'],
    },
    {
      categoryId: 'PERFORMANCE',
      categoryName: 'Performance',
      completionStatus: 'PARTIAL',
      completionPercent: 65,
      priority: 'SHOULD_HAVE',
      blockingIssues: [],
      remainingWork: [
        'Bulk regenerate performance path',
        'Cache invalidation clarity on publish flows',
      ],
      dependencies: ['CMS', 'GENERATOR'],
    },
    {
      categoryId: 'DEVELOPER_EXPERIENCE',
      categoryName: 'Developer Experience',
      completionStatus: 'PARTIAL',
      completionPercent: 55,
      priority: 'SHOULD_HAVE',
      blockingIssues: [
        'LOCAL_DEVELOPMENT_GUIDE missing',
        'No project-level CI',
      ],
      remainingWork: [
        'DX improvements deferred primarily to Program 6',
        'Baseline documents this as non-blocking for Feature Complete claim only where Must Have product scope is met',
      ],
      dependencies: ['DOCUMENTATION', 'TESTING'],
    },
    {
      categoryId: 'TESTING',
      categoryName: 'Testing',
      completionStatus: 'PARTIAL',
      completionPercent: 55,
      priority: 'SHOULD_HAVE',
      blockingIssues: [
        'Product HTTP/integration coverage thin relative to advisory suites',
      ],
      remainingWork: [
        'Program 4 package tests for baseline governance',
        'Broader product integration suite in Program 6',
      ],
      dependencies: ['CORE_PLATFORM', 'RECRUITMENT'],
    },
    {
      categoryId: 'DOCUMENTATION',
      categoryName: 'Documentation',
      completionStatus: 'PARTIAL',
      completionPercent: 50,
      priority: 'SHOULD_HAVE',
      blockingIssues: [
        'Operator day-to-day recruitment runbook weak',
        'LOCAL_DEVELOPMENT_GUIDE missing',
      ],
      remainingWork: [
        'Freeze this baseline as governance reference',
        'Operator docs expansions in later packages/programs',
      ],
      dependencies: ['DEVELOPER_EXPERIENCE'],
    },
    {
      categoryId: 'INFRASTRUCTURE',
      categoryName: 'Infrastructure',
      completionStatus: 'PARTIAL',
      completionPercent: 60,
      priority: 'SHOULD_HAVE',
      blockingIssues: [
        'Formal migration runner not required for Feature Complete',
        'Deploy tooling exists but deployment unauthorized',
      ],
      remainingWork: [
        'Keep deployment unauthorized under this baseline',
        'Migration runner hardening in Program 6',
      ],
      dependencies: ['OPERATIONS'],
    },
    {
      categoryId: 'OPERATIONS',
      categoryName: 'Operations',
      completionStatus: 'PARTIAL',
      completionPercent: 60,
      priority: 'MUST_HAVE',
      blockingIssues: [
        'Recruitment ops workflow incomplete without admin surfaces',
      ],
      remainingWork: [
        'Ops-usable recruitment workflow via Packages 4B–4E',
        'No production/VPS operations under this package',
      ],
      dependencies: ['ADMIN', 'RECRUITMENT', 'MONITORING'],
    },
  ],
});

const GAP_CLASSIFICATION = deepFreeze({
  classificationIdentity: 'CLASSIFICATION_FEATURE_GAPS',
  priorities: GAP_PRIORITIES.slice(),
  policy: {
    mustHaveBlocksFeatureComplete: true,
    shouldHaveBlocksDeploymentReady: true,
    niceToHaveOptionalBeforeLaunch: true,
    futureExcludedFromFeatureComplete: true,
  },
  gaps: [
    {
      gapId: 'GAP_FC_RECRUITMENT_ADMIN_CRUD',
      title: 'Recruitment Admin CRUD UI',
      classification: 'MUST_HAVE',
      categoryId: 'RECRUITMENT',
      program4Package: '4B',
      blocksFeatureComplete: true,
    },
    {
      gapId: 'GAP_FC_GENERATOR_BINDING_REVIEW_INBOX',
      title: 'Generator binding UX and review-queue primary inbox',
      classification: 'MUST_HAVE',
      categoryId: 'GENERATOR',
      program4Package: '4C',
      blocksFeatureComplete: true,
    },
    {
      gapId: 'GAP_FC_SHARED_PREVIEW_STORE',
      title: 'Shared preview store across web/worker processes',
      classification: 'MUST_HAVE',
      categoryId: 'RECRUITMENT',
      program4Package: '4D',
      blocksFeatureComplete: true,
    },
    {
      gapId: 'GAP_FC_ADMIN_STUBS',
      title: 'Admin stubs: bulk regenerate and Live Visitors',
      classification: 'MUST_HAVE',
      categoryId: 'ADMIN',
      program4Package: '4E',
      blocksFeatureComplete: true,
    },
    {
      gapId: 'GAP_FC_SEO_HUB_SITEMAP',
      title: 'SEO hub sitemap coverage and content-pipeline polish',
      classification: 'MUST_HAVE',
      categoryId: 'SEO',
      program4Package: '4F',
      blocksFeatureComplete: true,
    },
    {
      gapId: 'GAP_FC_PIPELINE_PERSIST_REVIEW',
      title: 'Flag-gated monitor to persisted review queue',
      classification: 'MUST_HAVE',
      categoryId: 'AUTOMATION',
      program4Package: null,
      successorProgram: 'PROGRAM_5',
      blocksFeatureComplete: true,
      note: 'Required for full Feature Complete claim; executed under Program 5 after Program 4 authorization gate.',
    },
    {
      gapId: 'GAP_FC_PUBLISH_READINESS_GATE',
      title: 'Publish readiness gate with no ungated auto-publish',
      classification: 'MUST_HAVE',
      categoryId: 'AUTOMATION',
      program4Package: null,
      successorProgram: 'PROGRAM_5',
      blocksFeatureComplete: true,
    },
    {
      gapId: 'GAP_FC_PIPELINE_HEALTH_ALERTS',
      title: 'Pipeline health and alerting',
      classification: 'MUST_HAVE',
      categoryId: 'MONITORING',
      program4Package: null,
      successorProgram: 'PROGRAM_5',
      blocksFeatureComplete: true,
    },
    {
      gapId: 'GAP_FC_PRODUCT_INTEGRATION_TESTS',
      title: 'Meaningful product integration tests',
      classification: 'SHOULD_HAVE',
      categoryId: 'TESTING',
      successorProgram: 'PROGRAM_6',
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_MIGRATION_RUNNER',
      title: 'Formal migration runner and rollback drills',
      classification: 'SHOULD_HAVE',
      categoryId: 'INFRASTRUCTURE',
      successorProgram: 'PROGRAM_6',
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_RBAC',
      title: 'Multi-admin RBAC baseline',
      classification: 'SHOULD_HAVE',
      categoryId: 'SECURITY',
      successorProgram: 'PROGRAM_6',
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_DX_CI_GUIDE',
      title: 'LOCAL_DEVELOPMENT_GUIDE and project CI',
      classification: 'SHOULD_HAVE',
      categoryId: 'DEVELOPER_EXPERIENCE',
      successorProgram: 'PROGRAM_6',
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_DEDUPE_GROUPING',
      title: 'MVP grouping and dedupe',
      classification: 'SHOULD_HAVE',
      categoryId: 'AUTOMATION',
      successorProgram: 'PROGRAM_5',
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_RICHER_METRICS',
      title: 'Richer metrics dashboard and diagnostics UI',
      classification: 'NICE_TO_HAVE',
      categoryId: 'ANALYTICS',
      successorProgram: 'PROGRAM_7',
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_AI_EXPLAINABILITY',
      title: 'Deeper AI assist and confidence explainability',
      classification: 'NICE_TO_HAVE',
      categoryId: 'AUTOMATION',
      successorProgram: 'PROGRAM_7',
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_PARSER_V2_DEFAULT',
      title: 'Parser v2 / mixed blocks default-on after soak',
      classification: 'NICE_TO_HAVE',
      categoryId: 'GENERATOR',
      successorProgram: 'PROGRAM_7',
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_USER_ACCOUNTS_ALERTS',
      title: 'End-user accounts and job alert subscriptions',
      classification: 'FUTURE',
      categoryId: 'CORE_PLATFORM',
      successorProgram: null,
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_FULL_AUTO_PUBLISH',
      title: 'Full auto-publish without human review',
      classification: 'FUTURE',
      categoryId: 'AUTOMATION',
      successorProgram: null,
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_MULTI_TENANT_SEARCH',
      title: 'Multi-tenant, Elasticsearch, advanced recommender',
      classification: 'FUTURE',
      categoryId: 'INFRASTRUCTURE',
      successorProgram: null,
      blocksFeatureComplete: false,
    },
    {
      gapId: 'GAP_FC_DEPLOYMENT_PROGRAMS',
      title: 'VPS / GitHub / production deployment programs',
      classification: 'FUTURE',
      categoryId: 'OPERATIONS',
      successorProgram: null,
      blocksFeatureComplete: false,
      note: 'Explicitly out of scope for Feature Complete and for Package 4A.',
    },
  ],
});

const PROGRAM_4_SCOPE = deepFreeze({
  scopeIdentity: 'SCOPE_PROGRAM_4_OFFICIAL_PACKAGE_LIST',
  programId: PROGRAM_ID,
  programName: 'Product Feature Closure',
  goal:
    'Make the manual portal and recruitment ops usable for Feature Completion Must Have scope without authorizing deployment.',
  packageOrder: PROGRAM_4_PACKAGE_IDS.slice(),
  packages: [
    {
      packageCode: '4A',
      packageId: PACKAGE_ID,
      packageName: PACKAGE_NAME,
      status: 'IN_PROGRESS',
      objective:
        'Freeze the official Feature Completion Baseline and Definition of Done that govern all remaining Program 4 work.',
      inputs: [
        'Programs 1–3 COMPLETE',
        'Local Implementation COMPLETE',
        'LOCAL_RELEASE_CERTIFIED',
        'Architectural feature-completion review findings',
      ],
      outputs: [
        'Deterministic Feature Completion Baseline Framework',
        'Official Definition of Done for FEATURE_COMPLETE',
        'Capability category baseline',
        'Gap classification matrix',
        'Official Program 4 package list 4A–4F',
        'Completion gates and roadmap summary',
      ],
      dependencies: [
        'PROGRAM_1_COMPLETE',
        'PROGRAM_2_COMPLETE',
        'PROGRAM_3_COMPLETE',
        'LOCAL_RELEASE_CERTIFIED',
      ],
      completionCriteria: [
        'Baseline framework module exists and is deep-frozen',
        'Independent completion states are explicitly separated',
        'Packages 4B–4F are listed with objectives and criteria',
        'Program 5 auto-start is denied',
        'Deployment and production remain unauthorized',
        'Advisory-only safety boundaries hold',
        'Framework tests pass',
      ],
    },
    {
      packageCode: '4B',
      packageId: 'PACKAGE_4B_RECRUITMENT_ADMIN_CRUD_UI',
      packageName: 'Recruitment Admin CRUD UI',
      status: 'NOT_STARTED',
      objective:
        'Deliver admin CRUD UI for recruitments, events, and page links so operators are not limited to API clients.',
      inputs: [
        'Package 4A Feature Completion Baseline',
        'Existing recruitment CRUD/events/page-link APIs',
        'Admin shell and auth baseline',
      ],
      outputs: [
        'Recruitment Manager list/create/edit surfaces',
        'Events timeline UI',
        'Page-link management UI',
        'Package 4B completion evidence',
      ],
      dependencies: ['4A'],
      completionCriteria: [
        'Operators can create/read/update recruitments in admin UI',
        'Events and page links manageable in admin UI',
        'No deployment or production activation',
        'Baseline Must Have gap GAP_FC_RECRUITMENT_ADMIN_CRUD addressed',
      ],
    },
    {
      packageCode: '4C',
      packageId: 'PACKAGE_4C_GENERATOR_BINDING_AND_REVIEW_INBOX',
      packageName: 'Generator Binding & Review Inbox',
      status: 'NOT_STARTED',
      objective:
        'Bind generator drafts to recruitments and establish the review queue as the primary admin inbox.',
      inputs: [
        'Package 4B recruitment admin surfaces',
        'Generator drafts workflow',
        'Review queue APIs',
      ],
      outputs: [
        'Draft ↔ recruitment binding UX',
        'Review-queue primary inbox workflow',
        'Approval gate surfaced in admin',
        'Package 4C completion evidence',
      ],
      dependencies: ['4A', '4B'],
      completionCriteria: [
        'Draft binding UX available to operators',
        'Review queue usable as primary inbox',
        'Human approval gate remains enforced',
        'Baseline Must Have gap GAP_FC_GENERATOR_BINDING_REVIEW_INBOX addressed',
      ],
    },
    {
      packageCode: '4D',
      packageId: 'PACKAGE_4D_SHARED_PREVIEW_STORE',
      packageName: 'Shared Preview Store',
      status: 'NOT_STARTED',
      objective:
        'Close the process-local runtime preview gap with a shared Redis/DB-backed preview store.',
      inputs: [
        'Package 4A baseline',
        'Existing process-local preview limitation',
        'Local Redis/runtime primitives',
      ],
      outputs: [
        'Shared preview store design and local implementation',
        'Cross-process preview visibility for web/worker',
        'Package 4D completion evidence',
      ],
      dependencies: ['4A'],
      completionCriteria: [
        'Preview is visible across web and worker processes',
        'Process-local-only limitation closed for scoped preview',
        'No production deployment',
        'Baseline Must Have gap GAP_FC_SHARED_PREVIEW_STORE addressed',
      ],
    },
    {
      packageCode: '4E',
      packageId: 'PACKAGE_4E_ADMIN_STUB_CLOSURE',
      packageName: 'Admin Stub Closure',
      status: 'NOT_STARTED',
      objective:
        'Resolve admin stubs by implementing bulk regenerate and Live Visitors, or removing them intentionally.',
      inputs: [
        'Package 4A baseline',
        'Existing admin stub surfaces',
      ],
      outputs: [
        'Bulk regenerate implemented or removed',
        'Live Visitors implemented or removed',
        'Package 4E completion evidence',
      ],
      dependencies: ['4A'],
      completionCriteria: [
        'No unresolved Coming soon stubs in scoped admin surfaces',
        'Operator-facing stub decisions recorded',
        'Baseline Must Have gap GAP_FC_ADMIN_STUBS addressed',
      ],
    },
    {
      packageCode: '4F',
      packageId: 'PACKAGE_4F_SEO_HUB_AND_CONTENT_PIPELINE_POLISH',
      packageName: 'SEO Hub & Content Pipeline Polish',
      status: 'NOT_STARTED',
      objective:
        'Complete SEO hub sitemap coverage and content-pipeline polish required by the Feature Completion Baseline.',
      inputs: [
        'Package 4A baseline',
        'Existing sitemap/SEO baseline',
        'Taxonomy hub routes',
      ],
      outputs: [
        'Hub sitemap coverage for qualification/state/topic',
        'Content-pipeline polish artifacts',
        'Package 4F completion evidence',
      ],
      dependencies: ['4A'],
      completionCriteria: [
        'Scoped hub URLs covered in sitemap generation',
        'Content-pipeline polish criteria for Package 4F met',
        'Baseline Must Have gap GAP_FC_SEO_HUB_SITEMAP addressed',
        'No deployment authorization granted',
      ],
    },
  ],
  outOfScope: [
    'DEPLOYMENT',
    'GITHUB',
    'VPS',
    'PRODUCTION_GO_LIVE',
    'PROGRAM_5_AUTO_START',
    'FEATURE_IMPLEMENTATION_INSIDE_PACKAGE_4A',
  ],
});

const COMPLETION_GATES = deepFreeze({
  gatesIdentity: 'GATES_FEATURE_COMPLETION',
  deterministic: true,
  autoStartDenied: {
    program5: true,
    deploymentProgram: true,
    productionProgram: true,
  },
  sequence: [
    {
      gateId: 'GATE_PROGRAM_4_COMPLETE',
      gateName: 'Program 4 Complete',
      requires: [
        'PACKAGE_4A_COMPLETE',
        'PACKAGE_4B_COMPLETE',
        'PACKAGE_4C_COMPLETE',
        'PACKAGE_4D_COMPLETE',
        'PACKAGE_4E_COMPLETE',
        'PACKAGE_4F_COMPLETE',
      ],
      unlocks: ['GATE_FEATURE_COMPLETE_ELIGIBILITY'],
      autoStartsNext: false,
      currentStatus: 'OPEN',
    },
    {
      gateId: 'GATE_FEATURE_COMPLETE_ELIGIBILITY',
      gateName: 'Feature Complete Eligibility',
      requires: [
        'GATE_PROGRAM_4_COMPLETE',
        'PROGRAM_5_MUST_HAVE_AUTOMATION_WIRING_COMPLETE',
        'ALL_MUST_HAVE_GAPS_SATISFIED',
        'NO_UNGATED_AUTO_PUBLISH',
      ],
      unlocks: ['GATE_FEATURE_COMPLETE'],
      autoStartsNext: false,
      currentStatus: 'LOCKED',
    },
    {
      gateId: 'GATE_FEATURE_COMPLETE',
      gateName: 'Feature Complete',
      requires: [
        'GATE_FEATURE_COMPLETE_ELIGIBILITY',
        'FEATURE_COMPLETE_CERTIFICATION_RECORDED',
      ],
      unlocks: ['GATE_PROGRAM_5_AUTHORIZATION_ELIGIBLE'],
      grantsState: 'FEATURE_COMPLETE',
      doesNotGrant: ['DEPLOYMENT_READY', 'PRODUCTION_READY'],
      autoStartsNext: false,
      currentStatus: 'LOCKED',
    },
    {
      gateId: 'GATE_PROGRAM_5_AUTHORIZATION_ELIGIBLE',
      gateName: 'Program 5 Authorized',
      requires: [
        'GATE_PROGRAM_4_COMPLETE',
        'EXPLICIT_PROGRAM_5_AUTHORIZATION',
      ],
      unlocks: ['PROGRAM_5_MAY_START'],
      autoStartsNext: false,
      automaticStartDenied: true,
      note:
        'Program 5 must NOT automatically start. Explicit authorization is required even after Program 4 completes.',
      currentStatus: 'LOCKED',
    },
  ],
  flow: [
    'Program 4 Complete',
    'Feature Complete',
    'Program 5 Authorized',
  ],
  flowRules: [
    'PROGRAM_4_COMPLETE_PRECEDES_FEATURE_COMPLETE_CLAIM',
    'FEATURE_COMPLETE_REQUIRES_MUST_HAVE_CLOSURE_INCLUDING_PROGRAM_5_SUCCESSORS',
    'PROGRAM_5_AUTHORIZATION_IS_EXPLICIT_AND_NON_AUTOMATIC',
    'FEATURE_COMPLETE_DOES_NOT_AUTHORIZE_DEPLOYMENT',
    'DEPLOYMENT_READY_REQUIRES_SEPARATE_FUTURE_PROGRAM',
  ],
});

const RISK_ASSESSMENT = deepFreeze({
  riskIdentity: 'RISKS_FEATURE_COMPLETION_BASELINE',
  scopeRisks: [
    {
      riskId: 'RISK_SCOPE_BASELINE_DRIFT',
      title: 'Baseline drift across later packages',
      severity: 'HIGH',
      mitigation:
        'Treat Package 4A as immutable single source of truth; later packages reference identities only.',
    },
    {
      riskId: 'RISK_SCOPE_CREEP_INTO_DEPLOYMENT',
      title: 'Scope creep into deployment/production work',
      severity: 'HIGH',
      mitigation:
        'Hard deny deployment, GitHub, VPS, and production actions in Program 4 safety boundaries.',
    },
    {
      riskId: 'RISK_SCOPE_COLLAPSE_STATES',
      title: 'Collapsing independent completion states',
      severity: 'HIGH',
      mitigation:
        'Keep Architecture/Implementation/Feature/Deployment/Production states independent in all certifications.',
    },
  ],
  technicalRisks: [
    {
      riskId: 'RISK_TECH_DUAL_TREE_CONFUSION',
      title: 'Dual-tree certified vs shipped confusion',
      severity: 'MEDIUM',
      mitigation:
        'Baseline clearly separates governance artifacts from product runtime surfaces.',
    },
    {
      riskId: 'RISK_TECH_PROCESS_LOCAL_PREVIEW',
      title: 'Process-local preview remains unresolved',
      severity: 'HIGH',
      mitigation: 'Package 4D is mandatory before Feature Complete eligibility.',
    },
    {
      riskId: 'RISK_TECH_OBSERVATION_ONLY_PIPELINE',
      title: 'Automation remains observation-only',
      severity: 'HIGH',
      mitigation:
        'Record Program 5 successor Must Have gaps; do not claim Feature Complete from Program 4 alone.',
    },
  ],
  dependencyRisks: [
    {
      riskId: 'RISK_DEP_4B_BLOCKS_4C',
      title: 'Package 4C depends on 4B admin surfaces',
      severity: 'MEDIUM',
      mitigation: 'Enforce package dependency order 4A → 4B → 4C.',
    },
    {
      riskId: 'RISK_DEP_PROGRAM_5_NOT_STARTED',
      title: 'Program 5 Must Have successors not yet authorized',
      severity: 'HIGH',
      mitigation:
        'Completion gates require explicit Program 5 authorization; auto-start denied.',
    },
    {
      riskId: 'RISK_DEP_LOCAL_CERT_MISREAD',
      title: 'LOCAL_RELEASE_CERTIFIED misread as Feature Complete',
      severity: 'HIGH',
      mitigation:
        'Baseline states local certification does not imply FEATURE_COMPLETE.',
    },
  ],
  operationalRisks: [
    {
      riskId: 'RISK_OPS_API_ONLY_WORKFLOW',
      title: 'Operators blocked without admin UI',
      severity: 'HIGH',
      mitigation: 'Prioritize Packages 4B and 4C for ops usability.',
    },
    {
      riskId: 'RISK_OPS_STUB_CONFUSION',
      title: 'Coming soon stubs confuse operators',
      severity: 'MEDIUM',
      mitigation: 'Package 4E must implement or remove stubs.',
    },
    {
      riskId: 'RISK_OPS_NO_DEPLOY_PRESSURE',
      title: 'Pressure to deploy before Feature Complete',
      severity: 'HIGH',
      mitigation:
        'Deployment remains unauthorized until a separate future program explicitly authorizes it.',
    },
  ],
});

const ROADMAP_SUMMARY = deepFreeze({
  roadmapIdentity: 'ROADMAP_FEATURE_COMPLETION_SUMMARY',
  currentPosition: {
    positionId: 'POSITION_PACKAGE_4A',
    description:
      'Programs 1–3 complete, local implementation complete, LOCAL_RELEASE_CERTIFIED. Program 4 Package 4A is freezing the Feature Completion Baseline.',
    featureComplete: false,
    deploymentAuthorized: false,
    productionReady: false,
  },
  nextPackage: {
    packageCode: '4B',
    packageId: 'PACKAGE_4B_RECRUITMENT_ADMIN_CRUD_UI',
    packageName: 'Recruitment Admin CRUD UI',
    startsAutomatically: false,
    requiresPackage4AComplete: true,
  },
  remainingPrograms: [
    {
      programId: PROGRAM_ID,
      shortName: 'Program 4',
      role: 'Product Feature Closure',
      status: 'IN_PROGRESS',
    },
    {
      programId: 'PROGRAM_5_CONTROLLED_AUTOMATION_WIRING',
      shortName: 'Program 5',
      role: 'Controlled Automation Wiring',
      status: 'NOT_STARTED',
      autoStartDenied: true,
    },
    {
      programId: 'PROGRAM_6_HARDENING_AND_QUALITY',
      shortName: 'Program 6',
      role: 'Hardening & Quality',
      status: 'NOT_STARTED',
    },
    {
      programId: 'PROGRAM_7_OPERATOR_EXCELLENCE',
      shortName: 'Program 7',
      role: 'Operator Excellence',
      status: 'NOT_STARTED',
      optionalBeforePublicLaunch: true,
    },
  ],
  estimatedRemainingScope: {
    estimateIdentity: 'ESTIMATE_REMAINING_FEATURE_SCOPE',
    program4PackagesRemainingAfter4A: ['4B', '4C', '4D', '4E', '4F'],
    mustHavePrograms: ['PROGRAM_4', 'PROGRAM_5'],
    shouldHavePrograms: ['PROGRAM_6'],
    niceToHavePrograms: ['PROGRAM_7'],
    effortBandMustHaveOnly: '8-13_ENGINEER_WEEKS',
    effortBandMustPlusShould: '11-18_ENGINEER_WEEKS',
    overallFeatureCompletionBand: '68-72_PERCENT',
    deploymentInEstimate: false,
    productionInEstimate: false,
  },
});

const FRAMEWORK = deepFreeze({
  version: FRAMEWORK_VERSION,
  program: PROGRAM_ID,
  package: PACKAGE_ID,
  packageCode: '4A',
  packageName: PACKAGE_NAME,
  frameworkIdentity: 'FRAMEWORK_FEATURE_COMPLETION_BASELINE',
  advisoryOnly: true,
  singleSourceOfTruth: true,
  architectureFrozen: true,
  productionSafe: true,
  runtimeIntegration: false,
  featureActivation: false,
  sqlExecuted: false,
  databaseChanged: false,
  apiCreated: false,
  routesCreated: false,
  schedulerModified: false,
  workerModified: false,
  publishingExecuted: false,
  githubAccessed: false,
  deploymentAuthorized: false,
  productionChanged: false,
  program4FeaturesImplemented: false,
  program5Started: false,
  program5AutoStartDenied: true,
  packageStage: 'PACKAGE_4A_FEATURE_COMPLETION_BASELINE_DEFINED',

  currentProjectState: CURRENT_PROJECT_STATE,
  definitionOfDone: DEFINITION_OF_DONE,
  capabilityCategories: CAPABILITY_CATEGORIES,
  gapClassification: GAP_CLASSIFICATION,
  program4Scope: PROGRAM_4_SCOPE,
  completionGates: COMPLETION_GATES,
  riskAssessment: RISK_ASSESSMENT,
  roadmapSummary: ROADMAP_SUMMARY,

  independentStates: INDEPENDENT_STATES.slice(),
  gapPriorities: GAP_PRIORITIES.slice(),
  capabilityCategoryIds: CAPABILITY_CATEGORY_IDS.slice(),
  program4PackageIds: PROGRAM_4_PACKAGE_IDS.slice(),

  safetyBoundaries: {
    boundariesIdentity: 'SAFETY_PACKAGE_4A_FEATURE_COMPLETION_BASELINE',
    advisoryOnly: true,
    runtimeIntegrationDenied: true,
    featureActivationDenied: true,
    sqlDenied: true,
    databaseChangesDenied: true,
    apiCreationDenied: true,
    routeCreationDenied: true,
    schedulerDenied: true,
    workerDenied: true,
    publishingDenied: true,
    githubDenied: true,
    deploymentDenied: true,
    productionChangesDenied: true,
    program4FeatureImplementationDenied: true,
    program5AutoStartDenied: true,
    hardDeniedActions: [
      'DENIED_RUNTIME_INTEGRATION',
      'DENIED_FEATURE_ACTIVATION',
      'DENIED_SQL',
      'DENIED_DATABASE_CHANGES',
      'DENIED_API_CREATION',
      'DENIED_ROUTE_CREATION',
      'DENIED_SCHEDULER',
      'DENIED_WORKER',
      'DENIED_PUBLISHING',
      'DENIED_GITHUB',
      'DENIED_DEPLOYMENT',
      'DENIED_PRODUCTION_CHANGES',
      'DENIED_PROGRAM_4_FEATURE_IMPLEMENTATION',
      'DENIED_PROGRAM_5_AUTO_START',
    ],
  },

  runtimeEffects: {
    effectsIdentity: 'RUNTIME_EFFECTS_PACKAGE_4A',
    runtimeActivated: false,
    databaseChanged: false,
    sqlExecuted: false,
    apiCreated: false,
    routesCreated: false,
    schedulerModified: false,
    workerModified: false,
    publishingExecuted: false,
    filesystemWritten: false,
    networkAccessed: false,
    githubAccessed: false,
    deploymentExecuted: false,
    productionImpact: false,
    program5Started: false,
  },

  packageSummary: {
    summaryIdentity: 'SUMMARY_PACKAGE_4A',
    status: 'BASELINE_FROZEN',
    purpose:
      'Freeze the official Feature Completion Baseline and Definition of Done for Program 4.',
    becomesGovernanceReference: true,
    nextPackage: '4B',
    featureComplete: false,
    deploymentAuthorized: false,
    program5Authorized: false,
  },

  recommendation:
    'FEATURE_COMPLETION_BASELINE_FROZEN_ADVISORY_ONLY_PROGRAM_5_NOT_STARTED',
});

function getFeatureCompletionBaselineFramework() {
  return FRAMEWORK;
}

function getFeatureCompletionBaselineFrameworkIdentity() {
  return deepFreeze({
    version: FRAMEWORK_VERSION,
    program: PROGRAM_ID,
    package: PACKAGE_ID,
    packageCode: '4A',
    packageName: PACKAGE_NAME,
    frameworkIdentity: 'FRAMEWORK_FEATURE_COMPLETION_BASELINE',
    advisoryOnly: true,
    singleSourceOfTruth: true,
    featureComplete: false,
    deploymentAuthorized: false,
    program5AutoStartDenied: true,
  });
}

function getCurrentProjectState() {
  return CURRENT_PROJECT_STATE;
}

function getDefinitionOfDone() {
  return DEFINITION_OF_DONE;
}

function getCapabilityCategories() {
  return CAPABILITY_CATEGORIES;
}

function getGapClassification() {
  return GAP_CLASSIFICATION;
}

function getProgram4Scope() {
  return PROGRAM_4_SCOPE;
}

function getCompletionGates() {
  return COMPLETION_GATES;
}

function getRiskAssessment() {
  return RISK_ASSESSMENT;
}

function getRoadmapSummary() {
  return ROADMAP_SUMMARY;
}

module.exports = {
  FRAMEWORK_VERSION,
  PROGRAM_ID,
  PACKAGE_ID,
  PACKAGE_NAME,
  GAP_PRIORITIES,
  INDEPENDENT_STATES,
  CAPABILITY_CATEGORY_IDS,
  PROGRAM_4_PACKAGE_IDS,
  getFeatureCompletionBaselineFramework,
  getFeatureCompletionBaselineFrameworkIdentity,
  getCurrentProjectState,
  getDefinitionOfDone,
  getCapabilityCategories,
  getGapClassification,
  getProgram4Scope,
  getCompletionGates,
  getRiskAssessment,
  getRoadmapSummary,
};
