'use strict';

/**
 * PROGRAM 5 — Package 5A
 * Pipeline Dependency Graph (Advisory Only)
 *
 * Logical dependencies between pipeline stages.
 * Advisory graph only — no execution engine.
 */

const {
  createPipelineHealthRegistry,
  getDefaultPipelineHealthRegistry,
} = require('./pipelineHealthRegistry');

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  const keys = Array.isArray(value) ? value.keys() : Object.keys(value);
  for (const key of keys) deepFreeze(value[key]);
  return value;
}

/**
 * Build an advisory dependency graph from a registry (or default).
 * @param {object} [registry]
 */
function buildPipelineDependencyGraph(registry) {
  const source =
    registry && Array.isArray(registry.stages)
      ? registry
      : getDefaultPipelineHealthRegistry();

  const nodes = source.stages.map((stage) => ({
    stageId: stage.stageId,
    name: stage.name,
    order: stage.order,
  }));

  const edges = [];
  const adjacency = {};
  const reverseAdjacency = {};

  for (let i = 0; i < source.stages.length; i += 1) {
    const stage = source.stages[i];
    adjacency[stage.stageId] = [];
    reverseAdjacency[stage.stageId] = reverseAdjacency[stage.stageId] || [];

    const deps = Array.isArray(stage.dependsOn) ? stage.dependsOn : [];
    for (let j = 0; j < deps.length; j += 1) {
      const from = deps[j];
      edges.push({
        from,
        to: stage.stageId,
        relation: 'DEPENDS_ON',
        advisoryOnly: true,
      });
      adjacency[stage.stageId].push(from);
      if (!reverseAdjacency[from]) {
        reverseAdjacency[from] = [];
      }
      reverseAdjacency[from].push(stage.stageId);
    }
  }

  return deepFreeze({
    advisoryOnly: true,
    executionEngine: false,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    adjacency,
    reverseAdjacency,
    summary: buildGraphSummary(nodes, edges),
  });
}

function buildGraphSummary(nodes, edges) {
  const highlights = [];
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i];
    if (
      (edge.to === 'SHARED_PREVIEW' && edge.from === 'DRAFT_PREPARATION') ||
      (edge.to === 'EDITORIAL_REVIEW' && edge.from === 'SHARED_PREVIEW') ||
      (edge.to === 'PUBLISH_READINESS' && edge.from === 'SEO_VALIDATION')
    ) {
      highlights.push(`${edge.to} depends on ${edge.from}`);
    }
  }

  return {
    description:
      'Advisory logical dependency graph between recruitment pipeline stages.',
    highlightedDependencies: highlights,
    rootStages: nodes
      .filter((n) => {
        const incoming = edges.filter((e) => e.to === n.stageId);
        return incoming.length === 0;
      })
      .map((n) => n.stageId),
    leafStages: nodes
      .filter((n) => {
        const outgoing = edges.filter((e) => e.from === n.stageId);
        return outgoing.length === 0;
      })
      .map((n) => n.stageId),
  };
}

/**
 * Validate dependency graph integrity (unknown refs, cycles).
 * @param {object} graph
 * @param {object} [registry]
 */
function validatePipelineDependencyGraph(graph, registry) {
  const issues = [];
  const source =
    registry && Array.isArray(registry.stages)
      ? registry
      : graph && Array.isArray(graph.nodes)
        ? { stages: graph.nodes.map((n) => ({ stageId: n.stageId, dependsOn: (graph.adjacency && graph.adjacency[n.stageId]) || [] })) }
        : createPipelineHealthRegistry();

  const knownIds = {};
  const stageList = source.stages || [];
  for (let i = 0; i < stageList.length; i += 1) {
    knownIds[stageList[i].stageId] = true;
  }

  if (graph && Array.isArray(graph.edges)) {
    for (let i = 0; i < graph.edges.length; i += 1) {
      const edge = graph.edges[i];
      if (!knownIds[edge.from]) {
        issues.push({
          code: 'UNKNOWN_DEPENDENCY_SOURCE',
          severity: 'ERROR',
          message: `Dependency source "${edge.from}" is not a registered stage.`,
          edge,
        });
      }
      if (!knownIds[edge.to]) {
        issues.push({
          code: 'UNKNOWN_DEPENDENCY_TARGET',
          severity: 'ERROR',
          message: `Dependency target "${edge.to}" is not a registered stage.`,
          edge,
        });
      }
    }
  }

  const cycle = detectCycle(graph);
  if (cycle) {
    issues.push({
      code: 'DEPENDENCY_CYCLE',
      severity: 'ERROR',
      message: `Dependency cycle detected: ${cycle.join(' -> ')}`,
      cycle,
    });
  }

  return deepFreeze({
    valid: issues.length === 0,
    advisoryOnly: true,
    executionEngine: false,
    issueCount: issues.length,
    issues,
  });
}

function detectCycle(graph) {
  if (!graph || !graph.adjacency) return null;

  const visiting = {};
  const visited = {};
  const stack = [];

  function dfs(node) {
    visiting[node] = true;
    stack.push(node);
    const deps = graph.adjacency[node] || [];
    for (let i = 0; i < deps.length; i += 1) {
      const next = deps[i];
      // adjacency stores "depends on" upstream; walk upstream for cycles
      if (visiting[next]) {
        const start = stack.indexOf(next);
        return stack.slice(start).concat(next);
      }
      if (!visited[next]) {
        const found = dfs(next);
        if (found) return found;
      }
    }
    stack.pop();
    visiting[node] = false;
    visited[node] = true;
    return null;
  }

  const nodes = graph.nodes || [];
  for (let i = 0; i < nodes.length; i += 1) {
    const id = nodes[i].stageId;
    if (!visited[id]) {
      const found = dfs(id);
      if (found) return found;
    }
  }
  return null;
}

function getUpstreamDependencies(graph, stageId) {
  if (!graph || !graph.adjacency || typeof stageId !== 'string') {
    return [];
  }
  return (graph.adjacency[stageId] || []).slice();
}

function getDownstreamDependents(graph, stageId) {
  if (!graph || !graph.reverseAdjacency || typeof stageId !== 'string') {
    return [];
  }
  return (graph.reverseAdjacency[stageId] || []).slice();
}

module.exports = {
  buildPipelineDependencyGraph,
  validatePipelineDependencyGraph,
  getUpstreamDependencies,
  getDownstreamDependents,
};
