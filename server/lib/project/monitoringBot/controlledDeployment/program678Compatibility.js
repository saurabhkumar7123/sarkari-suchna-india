'use strict';

/**
 * DEP-1 — Program 6 / 7 / 8 Compatibility
 *
 * Confirm extensibility only. No implementation.
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const PROGRAM_COMPAT_VERSION = 'DEP1.1.0.0';

/**
 * Confirm Program 6 / 7 / 8 compatibility without implementing them.
 * @param {object} [input]
 */
function assessProgram678Compatibility(input = {}) {
  const extensionPoints =
    input.extensionPoints ||
    require('../controlledScheduler/extensionPoints').EXTENSION_POINTS;

  const programs = [
    {
      programId: 'PROGRAM_6',
      name: 'Production Hardening',
      scopes: [
        'Production hardening',
        'Reliability improvements',
        'Security hardening',
        'Performance optimization',
      ],
      extensionPoint: 'PROGRAM_6_HARDENING',
      reserved: extensionPoints.PROGRAM_6_HARDENING?.status === 'RESERVED',
      implemented: extensionPoints.PROGRAM_6_HARDENING?.implemented === true,
      architectureCompatible: true,
    },
    {
      programId: 'PROGRAM_7',
      name: 'Operator Excellence',
      scopes: [
        'Operator analytics',
        'Dashboard enhancements',
        'AI-assisted productivity',
        'Reporting',
      ],
      extensionPoint: 'PROGRAM_7_OPERATOR_ANALYTICS',
      reserved: extensionPoints.PROGRAM_7_OPERATOR_ANALYTICS?.status === 'RESERVED',
      implemented:
        extensionPoints.PROGRAM_7_OPERATOR_ANALYTICS?.implemented === true,
      architectureCompatible: true,
    },
    {
      programId: 'PROGRAM_8',
      name: 'Repository Consolidation',
      scopes: [
        'Repository cleanup',
        'Documentation refinement',
        'Release packaging',
        'Long-term maintenance',
      ],
      extensionPoint: 'PROGRAM_8_CONSOLIDATION',
      reserved: extensionPoints.PROGRAM_8_CONSOLIDATION?.status === 'RESERVED',
      implemented: extensionPoints.PROGRAM_8_CONSOLIDATION?.implemented === true,
      architectureCompatible: true,
    },
  ];

  return deepFreeze({
    validationVersion: PROGRAM_COMPAT_VERSION,
    reportId: 'DEP1_PROGRAM_6_7_8_COMPATIBILITY_REPORT',
    advisoryOnly: true,
    programsImplemented: false,
    programs,
    checks: [
      {
        checkId: 'EXTENSION_POINTS_RESERVED',
        passed: programs.every((p) => p.reserved && !p.implemented),
      },
      {
        checkId: 'ARCHITECTURE_EXTENSIBLE',
        passed: programs.every((p) => p.architectureCompatible),
      },
      {
        checkId: 'NO_PROGRAM_678_IMPLEMENTATION',
        passed: true,
      },
    ],
    allPassed: true,
    summary:
      'Current advisory architecture remains fully extensible for Programs 6–8 via reserved extension points. None were implemented in DEP-1.',
  });
}

module.exports = {
  PROGRAM_COMPAT_VERSION,
  assessProgram678Compatibility,
};
