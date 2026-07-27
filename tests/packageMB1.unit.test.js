'use strict';

/**
 * Package MB-1 — Product-side unit tests (advisory government source registry).
 */

const {
  SOURCE_CATEGORIES,
  CONTENT_TYPES,
  SOURCE_HEALTH,
  DIAGNOSTIC_CODES,
  evaluateProductGovernmentSourceRegistry,
  getGovernmentSourceRegistryFramework,
  createGovernmentSourceRegistry,
  createParserRegistry,
  validateGovernmentSourceRegistry,
} = require('../server/lib/monitoringBot/governmentSourceRegistry');

describe('Package MB-1 government source registry (product advisory)', () => {
  test('framework identity is MB-1 advisory-only ready for MB-2', () => {
    const framework = getGovernmentSourceRegistryFramework();
    expect(framework.packageCode).toBe('MB-1');
    expect(framework.advisoryOnly).toBe(true);
    expect(framework.runtimeEffects.routesCreated).toBe(false);
    expect(framework.runtimeEffects.featureActivated).toBe(false);
    expect(framework.runtimeEffects.monitoringExecuted).toBe(false);
    expect(framework.runtimeEffects.httpRequestsPerformed).toBe(false);
    expect(framework.runtimeEffects.websitesVisited).toBe(false);
    expect(framework.runtimeEffects.pagesScraped).toBe(false);
    expect(framework.monitoringAuthorized).toBe(false);
    expect(framework.packageMB1Complete).toBe(true);
    expect(framework.packageMB2Ready).toBe(true);
    expect(framework.packageMB2Activated).toBe(false);
    expect(framework.programs1to5PrerequisiteComplete).toBe(true);
    expect(framework.extensionPoints.PROGRAM_6_HARDENING.activated).toBe(false);
    expect(framework.extensionPoints.MB2_WEBSITE_CHANGE_DETECTION.activated).toBe(
      false
    );
  });

  test('product evaluation reuses Program 5 governance identities', () => {
    const result = evaluateProductGovernmentSourceRegistry();
    expect(result.productReuse.pipelineHealth).toBe(true);
    expect(result.productReuse.monitoringReviewIntegration).toBe(true);
    expect(result.productReuse.adminDashboard).toBe(true);
    expect(result.productReuse.publishReadinessAuthorization).toBe(true);
    expect(result.productReuse.programs1to5Complete).toBe(true);
    expect(result.advisoryOnly).toBe(true);
    expect(result.monitoringExecuted).toBe(false);
    expect(result.httpRequestsPerformed).toBe(false);
    expect(result.validation.valid).toBe(true);
    expect(result.sourceRegistry.byId.SSC_NIC.category).toBe(
      SOURCE_CATEGORIES.CENTRAL_EXAM
    );
    expect(
      result.monitoringConfiguration.bySourceId.SSC_NIC.expectedContentType
    ).toBe(CONTENT_TYPES.HTML);
    expect(result.dashboard.readOnly).toBe(true);
    expect(result.dashboard.routesCreated).toBe(false);
  });

  test('product validation surfaces missing parser registration', () => {
    const sourceRegistry = createGovernmentSourceRegistry({
      sources: [
        {
          sourceId: 'CUSTOM_SRC',
          displayName: 'Custom',
          organization: 'Org',
          department: 'Dept',
          category: SOURCE_CATEGORIES.OTHER,
          baseUrl: 'https://custom.example.gov.in',
          recruitmentUrl: 'https://custom.example.gov.in/r',
          resultUrl: 'https://custom.example.gov.in/res',
          noticeUrl: 'https://custom.example.gov.in/n',
          active: true,
        },
      ],
    });

    const result = evaluateProductGovernmentSourceRegistry({
      sourceRegistry,
      monitoringConfigurations: {
        CUSTOM_SRC: {
          parserId: 'PARSER_MISSING',
          monitoringEnabled: true,
          expectedContentType: CONTENT_TYPES.JSON,
        },
      },
      parserRegistry: createParserRegistry({
        parsers: [
          {
            parserId: 'PARSER_OTHER',
            parserVersion: '1.0.0',
            supportedFormats: [CONTENT_TYPES.HTML],
            validationRules: [],
          },
        ],
      }),
    });

    expect(result.validation.valid).toBe(false);
    expect(
      result.validation.diagnostics.some(
        (d) => d.code === DIAGNOSTIC_CODES.MISSING_PARSER_REGISTRATION
      )
    ).toBe(true);
  });

  test('health metadata remains read-only with no HTTP checks', () => {
    const result = evaluateProductGovernmentSourceRegistry({
      healthObservations: {
        SSC_NIC: {
          consecutiveFailures: 0,
          currentHealth: SOURCE_HEALTH.HEALTHY,
          lastSuccessfulCheck: '2026-07-19T12:00:00.000Z',
          advisoryNotes: ['Advisory only'],
        },
      },
    });

    expect(result.healthMap.bySourceId.SSC_NIC.readOnly).toBe(true);
    expect(result.healthMap.httpCheckPerformed).toBe(false);
    expect(result.healthMap.bySourceId.SSC_NIC.currentHealth).toBe(
      SOURCE_HEALTH.HEALTHY
    );
  });

  test('standalone validation helper remains advisory', () => {
    const validation = validateGovernmentSourceRegistry({
      sourceRegistry: createGovernmentSourceRegistry(),
    });
    expect(validation.advisoryOnly).toBe(true);
    expect(validation.autoRemediation).toBe(false);
  });
});
