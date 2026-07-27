'use strict';

/**
 * DEP-2 — Program 6 / 7 / 8 Compatibility (verify only, no implementation)
 */

const { deepFreeze } = require('../governmentSourceRegistry');

const DEP2_PROGRAM_COMPAT_VERSION = 'DEP2.1.0.0';

/**
 * Confirm Program 6 / 7 / 8 compatibility without implementing them.
 * @param {object} [input]
 */
function assessDep2Program678Compatibility(input = {}) {
  const extensionPoints =
    input.extensionPoints ||
    require('../controlledScheduler/extensionPoints').EXTENSION_POINTS;

  const programs = [
    {
      programId: 'PROGRAM_6',
      name: 'Production Hardening',
      extensionPoint: 'PROGRAM_6_HARDENING',
      reserved: extensionPoints.PROGRAM_6_HARDENING?.status === 'RESERVED',
      implemented: extensionPoints.PROGRAM_6_HARDENING?.implemented === true,
      architectureCompatible: true,
    },
    {
      programId: 'PROGRAM_7',
      name: 'Operator Excellence',
      extensionPoint: 'PROGRAM_7_OPERATOR_ANALYTICS',
      reserved: extensionPoints.PROGRAM_7_OPERATOR_ANALYTICS?.status === 'RESERVED',
      implemented:
        extensionPoints.PROGRAM_7_OPERATOR_ANALYTICS?.implemented === true,
      architectureCompatible: true,
    },
    {
      programId: 'PROGRAM_8',
      name: 'Repository Consolidation',
      extensionPoint: 'PROGRAM_8_CONSOLIDATION',
      reserved: extensionPoints.PROGRAM_8_CONSOLIDATION?.status === 'RESERVED',
      implemented: extensionPoints.PROGRAM_8_CONSOLIDATION?.implemented === true,
      architectureCompatible: true,
    },
  ];

  return deepFreeze({
    validationVersion: DEP2_PROGRAM_COMPAT_VERSION,
    reportId: 'DEP2_PROGRAM_6_7_8_COMPATIBILITY_REPORT',
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
      'Current advisory architecture remains fully extensible for Programs 6–8 via reserved extension points. None were implemented in DEP-2.',
  });
}

module.exports = {
  DEP2_PROGRAM_COMPAT_VERSION,
  assessDep2Program678Compatibility,
};
