"use strict";

/**
 * Phase 139 — Recruitment Workflow Dependency Resolver (Advisory Only).
 *
 * Pure advisory static dependency analysis for Phases 114–138 advisory modules.
 * Performs dependency graph analysis only — no execution, no runtime imports,
 * no persistence, no side effects. No automation. Never mutates input.
 * Never persists output.
 */

const RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_PHASE = 139;

const RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_ENTITY =
  "recruitment_workflow_dependency_resolver";

const DEPENDENCY_SCHEMA_VERSION = "1.0.0";

const DEPENDENCY_ANALYSIS_STATUS = Object.freeze({
  RESOLVED: "RESOLVED",
  PARTIALLY_RESOLVED: "PARTIALLY_RESOLVED",
  UNRESOLVED: "UNRESOLVED"
});

const DEPENDENCY_EDGE_TYPE = Object.freeze({
  DIRECT: "DIRECT",
  TRANSITIVE: "TRANSITIVE"
});

const STATIC_DEPENDENCY_GRAPH = Object.freeze([
  Object.freeze({ phase: 114, dependsOn: Object.freeze([]) }),
  Object.freeze({ phase: 115, dependsOn: Object.freeze([114]) }),
  Object.freeze({ phase: 116, dependsOn: Object.freeze([115]) }),
  Object.freeze({ phase: 117, dependsOn: Object.freeze([114, 115, 116]) }),
  Object.freeze({ phase: 118, dependsOn: Object.freeze([117]) }),
  Object.freeze({ phase: 119, dependsOn: Object.freeze([118]) }),
  Object.freeze({ phase: 120, dependsOn: Object.freeze([117]) }),
  Object.freeze({ phase: 121, dependsOn: Object.freeze([120]) }),
  Object.freeze({ phase: 122, dependsOn: Object.freeze([121]) }),
  Object.freeze({ phase: 123, dependsOn: Object.freeze([120, 122]) }),
  Object.freeze({ phase: 124, dependsOn: Object.freeze([123]) }),
  Object.freeze({ phase: 125, dependsOn: Object.freeze([123, 124]) }),
  Object.freeze({ phase: 126, dependsOn: Object.freeze([125]) }),
  Object.freeze({ phase: 127, dependsOn: Object.freeze([126]) }),
  Object.freeze({ phase: 128, dependsOn: Object.freeze([125, 127]) }),
  Object.freeze({ phase: 129, dependsOn: Object.freeze([128]) }),
  Object.freeze({ phase: 130, dependsOn: Object.freeze([120, 127, 128, 129]) }),
  Object.freeze({ phase: 131, dependsOn: Object.freeze([130]) }),
  Object.freeze({ phase: 132, dependsOn: Object.freeze([131]) }),
  Object.freeze({ phase: 133, dependsOn: Object.freeze([130, 131, 132]) }),
  Object.freeze({ phase: 134, dependsOn: Object.freeze([133]) }),
  Object.freeze({ phase: 135, dependsOn: Object.freeze([134]) }),
  Object.freeze({ phase: 136, dependsOn: Object.freeze([135]) }),
  Object.freeze({ phase: 137, dependsOn: Object.freeze([136]) }),
  Object.freeze({ phase: 138, dependsOn: Object.freeze([137]) })
]);

const RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_METADATA = Object.freeze({
  phase: RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_PHASE,
  advisoryOnly: true,
  persistent: false,
  generatedBy: "phase_139",
  descriptiveOnly: true,
  architectureOnly: true,
  runtimeIntegration: false,
  persistenceEnabled: false,
  integrationPersistence: false,
  automationEnabled: false,
  alertingEnabled: false,
  historyTracking: false,
  sideEffects: false,
  mutatesInput: false,
  mutatesProduction: false,
  executed: false,
  staticAnalysisOnly: true,
  sourcePhases: Object.freeze([
    114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131,
    132, 133, 134, 135, 136, 137, 138
  ])
});

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {*} value
 * @returns {*}
 */
function deepFreeze(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
    return value;
  }
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    deepFreeze(value[keys[i]]);
  }
  return value;
}

/**
 * @param {number} phase
 * @returns {Readonly<Object>|null}
 */
function findDependencyNode(phase) {
  for (let i = 0; i < STATIC_DEPENDENCY_GRAPH.length; i += 1) {
    if (STATIC_DEPENDENCY_GRAPH[i].phase === phase) {
      return STATIC_DEPENDENCY_GRAPH[i];
    }
  }
  return null;
}

/**
 * @param {number} phase
 * @param {Readonly<Set>} visited
 * @param {Readonly<Set>} stack
 * @returns {Readonly<Array>}
 */
function collectTransitiveDependencies(phase, visited, stack) {
  const node = findDependencyNode(phase);
  if (node == null) {
    return Object.freeze([]);
  }

  const transitive = [];
  const directDeps = node.dependsOn;

  for (let i = 0; i < directDeps.length; i += 1) {
    const dep = directDeps[i];
    if (!visited.has(dep)) {
      visited.add(dep);
      transitive.push(dep);
      const nested = collectTransitiveDependencies(dep, visited, stack);
      for (let j = 0; j < nested.length; j += 1) {
        if (!transitive.includes(nested[j])) {
          transitive.push(nested[j]);
        }
      }
    }
  }

  return Object.freeze(transitive.slice());
}

/**
 * @param {number} phase
 * @returns {Readonly<Array>}
 */
function detectCircularDependencies(phase) {
  const stack = [];
  const visiting = new Set();

  function visit(current) {
    if (visiting.has(current)) {
      return Object.freeze([current]);
    }
    visiting.add(current);
    stack.push(current);

    const node = findDependencyNode(current);
    if (node != null) {
      for (let i = 0; i < node.dependsOn.length; i += 1) {
        const cycle = visit(node.dependsOn[i]);
        if (cycle.length > 0) {
          return cycle;
        }
      }
    }

    visiting.delete(current);
    stack.pop();
    return Object.freeze([]);
  }

  return visit(phase);
}

/**
 * @param {Readonly<Array>} includedPhases
 * @returns {Readonly<Array>}
 */
function buildDependencyEdges(includedPhases) {
  const includedSet = new Set(includedPhases);
  const edges = [];

  for (let i = 0; i < includedPhases.length; i += 1) {
    const phase = includedPhases[i];
    const node = findDependencyNode(phase);
    if (node == null) {
      continue;
    }

    for (let j = 0; j < node.dependsOn.length; j += 1) {
      const dependency = node.dependsOn[j];
      if (includedSet.has(dependency)) {
        edges.push(
          deepFreeze({
            fromPhase: dependency,
            toPhase: phase,
            edgeType: DEPENDENCY_EDGE_TYPE.DIRECT
          })
        );
      }
    }
  }

  return Object.freeze(edges);
}

/**
 * @param {*} input
 * @returns {boolean}
 */
function isRecognizedDependencyInput(input) {
  if (!isPlainObject(input)) {
    return false;
  }
  if (input.targetPhase != null && typeof input.targetPhase !== "number") {
    return false;
  }
  if (input.includedPhases != null && !Array.isArray(input.includedPhases)) {
    return false;
  }
  return true;
}

/**
 * @param {Readonly<Object>} input
 * @returns {Readonly<Array>}
 */
function resolveIncludedPhases(input) {
  if (Array.isArray(input.includedPhases)) {
    if (input.includedPhases.length === 0) {
      return [];
    }
    return input.includedPhases.filter((phase) => typeof phase === "number");
  }

  if (typeof input.targetPhase === "number") {
    const phases = [];
    for (let i = 114; i <= input.targetPhase; i += 1) {
      if (findDependencyNode(i) != null) {
        phases.push(i);
      }
    }
    return phases;
  }

  return STATIC_DEPENDENCY_GRAPH.map((node) => node.phase);
}

/**
 * @param {*} recruitmentId
 * @returns {string|null}
 */
function resolveRecruitmentId(recruitmentId) {
  if (recruitmentId == null) {
    return null;
  }
  return String(recruitmentId);
}

/**
 * @param {Readonly<Array>} includedPhases
 * @returns {string}
 */
function resolveAnalysisStatus(includedPhases) {
  if (includedPhases.length === 0) {
    return DEPENDENCY_ANALYSIS_STATUS.UNRESOLVED;
  }
  if (includedPhases.length === STATIC_DEPENDENCY_GRAPH.length) {
    return DEPENDENCY_ANALYSIS_STATUS.RESOLVED;
  }
  return DEPENDENCY_ANALYSIS_STATUS.PARTIALLY_RESOLVED;
}

/**
 * @param {Object|null|undefined} input
 * @returns {Readonly<Object>}
 */
function analyzeRecruitmentWorkflowDependencies(input) {
  const normalizedInput = isRecognizedDependencyInput(input) ? input : {};
  const includedPhases = resolveIncludedPhases(normalizedInput);
  const dependencyEdges = buildDependencyEdges(includedPhases);
  const recruitmentId = resolveRecruitmentId(normalizedInput.recruitmentId);
  const analysisStatus = resolveAnalysisStatus(includedPhases);

  const phaseAnalyses = [];
  for (let i = 0; i < includedPhases.length; i += 1) {
    const phase = includedPhases[i];
    const node = findDependencyNode(phase);
    if (node == null) {
      continue;
    }

    const visited = new Set();
    const transitiveDependencies = collectTransitiveDependencies(phase, visited, new Set());
    const circularDependencies = detectCircularDependencies(phase);

    phaseAnalyses.push(
      deepFreeze({
        phase,
        directDependencies: node.dependsOn,
        transitiveDependencies,
        hasCircularDependency: circularDependencies.length > 0,
        circularPhases: circularDependencies
      })
    );
  }

  const rootPhases = includedPhases.filter((phase) => {
    const node = findDependencyNode(phase);
    return node != null && node.dependsOn.length === 0;
  });

  const leafPhases = includedPhases.filter((phase) => {
    let isLeaf = true;
    for (let i = 0; i < STATIC_DEPENDENCY_GRAPH.length; i += 1) {
      if (STATIC_DEPENDENCY_GRAPH[i].dependsOn.includes(phase)) {
        if (includedPhases.includes(STATIC_DEPENDENCY_GRAPH[i].phase)) {
          isLeaf = false;
          break;
        }
      }
    }
    return isLeaf;
  });

  return deepFreeze({
    entity: RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_ENTITY,
    phase: RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_PHASE,
    schemaVersion: DEPENDENCY_SCHEMA_VERSION,
    recruitmentId,
    analysisStatus,
    includedPhaseCount: includedPhases.length,
    dependencyEdgeCount: dependencyEdges.length,
    includedPhases: Object.freeze(includedPhases.slice()),
    dependencyEdges,
    phaseAnalyses: Object.freeze(phaseAnalyses),
    rootPhases: Object.freeze(rootPhases),
    leafPhases: Object.freeze(leafPhases),
    staticDependencyGraph: STATIC_DEPENDENCY_GRAPH,
    dependencySummary:
      analysisStatus === DEPENDENCY_ANALYSIS_STATUS.RESOLVED
        ? "Static dependency analysis resolved for Phases 114–138 advisory modules"
        : analysisStatus === DEPENDENCY_ANALYSIS_STATUS.PARTIALLY_RESOLVED
          ? "Static dependency analysis partially resolved"
          : "Static dependency analysis could not be resolved",
    advisoryMetadata: deepFreeze({
      advisoryOnly: true,
      persistent: false,
      generatedBy: "phase_139",
      phase: RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_PHASE,
      architectureOnly: true,
      executed: false,
      persistenceEnabled: false,
      integrationPersistence: false,
      automationEnabled: false,
      alertingEnabled: false,
      historyTracking: false,
      sideEffects: false,
      mutatesInput: false,
      staticAnalysisOnly: true
    })
  });
}

module.exports = {
  RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_PHASE,
  RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_ENTITY,
  DEPENDENCY_SCHEMA_VERSION,
  DEPENDENCY_ANALYSIS_STATUS,
  DEPENDENCY_EDGE_TYPE,
  STATIC_DEPENDENCY_GRAPH,
  RECRUITMENT_WORKFLOW_DEPENDENCY_RESOLVER_METADATA,
  analyzeRecruitmentWorkflowDependencies
};
