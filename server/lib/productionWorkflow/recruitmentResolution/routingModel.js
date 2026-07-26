"use strict";

/**
 * PWP Phase 2 — Routing model.
 * Maps resolution decisions to output destinations only.
 */

const {
  RESOLUTION_DECISIONS,
  ROUTE_DESTINATIONS,
  RECOMMENDED_ACTIONS
} = require("./resolutionTypes");

const DECISION_ROUTING = Object.freeze({
  [RESOLUTION_DECISIONS.CREATE_NEW_RECRUITMENT]: Object.freeze({
    destinations: Object.freeze([
      ROUTE_DESTINATIONS.GENERATOR,
      ROUTE_DESTINATIONS.EDITORIAL_QUEUE
    ]),
    recommendedActions: Object.freeze([
      RECOMMENDED_ACTIONS.CREATE_RECRUITMENT_PACKAGE,
      RECOMMENDED_ACTIONS.CREATE_GENERATOR_DRAFT,
      RECOMMENDED_ACTIONS.QUEUE_EDITORIAL_REVIEW
    ]),
    haltPipeline: false,
    createDraft: true,
    queueEditorial: true
  }),
  [RESOLUTION_DECISIONS.CREATE_NEW_PAGE]: Object.freeze({
    destinations: Object.freeze([
      ROUTE_DESTINATIONS.GENERATOR,
      ROUTE_DESTINATIONS.EDITORIAL_QUEUE
    ]),
    recommendedActions: Object.freeze([
      RECOMMENDED_ACTIONS.CREATE_RECRUITMENT_PACKAGE,
      RECOMMENDED_ACTIONS.CREATE_PAGE_DRAFT,
      RECOMMENDED_ACTIONS.QUEUE_EDITORIAL_REVIEW
    ]),
    haltPipeline: false,
    createDraft: true,
    queueEditorial: true
  }),
  [RESOLUTION_DECISIONS.UPDATE_EXISTING_PAGE]: Object.freeze({
    destinations: Object.freeze([
      ROUTE_DESTINATIONS.GENERATOR,
      ROUTE_DESTINATIONS.EDITORIAL_QUEUE
    ]),
    recommendedActions: Object.freeze([
      RECOMMENDED_ACTIONS.CREATE_UPDATE_DRAFT,
      RECOMMENDED_ACTIONS.QUEUE_EDITORIAL_REVIEW
    ]),
    haltPipeline: false,
    createDraft: true,
    queueEditorial: true
  }),
  [RESOLUTION_DECISIONS.UPDATE_EXISTING_RECRUITMENT]: Object.freeze({
    destinations: Object.freeze([
      ROUTE_DESTINATIONS.GENERATOR,
      ROUTE_DESTINATIONS.EDITORIAL_QUEUE
    ]),
    recommendedActions: Object.freeze([
      RECOMMENDED_ACTIONS.UPDATE_RECRUITMENT_RECORD,
      RECOMMENDED_ACTIONS.CREATE_UPDATE_DRAFT,
      RECOMMENDED_ACTIONS.QUEUE_EDITORIAL_REVIEW
    ]),
    haltPipeline: false,
    createDraft: true,
    queueEditorial: true
  }),
  [RESOLUTION_DECISIONS.IGNORE_DUPLICATE]: Object.freeze({
    destinations: Object.freeze([ROUTE_DESTINATIONS.REJECTED]),
    recommendedActions: Object.freeze([RECOMMENDED_ACTIONS.IGNORE]),
    haltPipeline: true,
    createDraft: false,
    queueEditorial: false
  }),
  [RESOLUTION_DECISIONS.SUPERSEDED_DOCUMENT]: Object.freeze({
    destinations: Object.freeze([
      ROUTE_DESTINATIONS.GENERATOR,
      ROUTE_DESTINATIONS.EDITORIAL_QUEUE
    ]),
    recommendedActions: Object.freeze([
      RECOMMENDED_ACTIONS.MARK_SUPERSEDED_AND_ROUTE_NEWEST,
      RECOMMENDED_ACTIONS.CREATE_UPDATE_DRAFT,
      RECOMMENDED_ACTIONS.QUEUE_EDITORIAL_REVIEW
    ]),
    haltPipeline: false,
    createDraft: true,
    queueEditorial: true,
    routeNewest: true
  }),
  [RESOLUTION_DECISIONS.MANUAL_REVIEW_REQUIRED]: Object.freeze({
    destinations: Object.freeze([ROUTE_DESTINATIONS.MANUAL_REVIEW]),
    recommendedActions: Object.freeze([RECOMMENDED_ACTIONS.QUEUE_MANUAL_REVIEW]),
    haltPipeline: true,
    createDraft: false,
    queueEditorial: false
  }),
  [RESOLUTION_DECISIONS.UNSUPPORTED]: Object.freeze({
    destinations: Object.freeze([ROUTE_DESTINATIONS.REJECTED]),
    recommendedActions: Object.freeze([RECOMMENDED_ACTIONS.NO_ACTION]),
    haltPipeline: true,
    createDraft: false,
    queueEditorial: false
  })
});

function buildRouting(decision) {
  const plan = DECISION_ROUTING[decision];
  if (!plan) {
    return {
      decision: RESOLUTION_DECISIONS.UNSUPPORTED,
      destinations: [ROUTE_DESTINATIONS.REJECTED],
      recommendedActions: [RECOMMENDED_ACTIONS.NO_ACTION],
      haltPipeline: true,
      createDraft: false,
      queueEditorial: false,
      routeNewest: false,
      includesGenerator: false,
      includesEditorialQueue: false,
      includesManualReview: false,
      includesRejected: true
    };
  }

  const destinations = plan.destinations.slice();
  return {
    decision,
    destinations,
    recommendedActions: plan.recommendedActions.slice(),
    haltPipeline: Boolean(plan.haltPipeline),
    createDraft: Boolean(plan.createDraft),
    queueEditorial: Boolean(plan.queueEditorial),
    routeNewest: Boolean(plan.routeNewest),
    includesGenerator: destinations.includes(ROUTE_DESTINATIONS.GENERATOR),
    includesEditorialQueue: destinations.includes(ROUTE_DESTINATIONS.EDITORIAL_QUEUE),
    includesManualReview: destinations.includes(ROUTE_DESTINATIONS.MANUAL_REVIEW),
    includesRejected: destinations.includes(ROUTE_DESTINATIONS.REJECTED)
  };
}

function shouldRunGenerator(resolution) {
  return Boolean(
    resolution &&
      resolution.routing &&
      resolution.routing.includesGenerator &&
      resolution.routing.createDraft
  );
}

function shouldRunEditorialQueue(resolution) {
  return Boolean(
    resolution &&
      resolution.routing &&
      resolution.routing.includesEditorialQueue &&
      resolution.routing.queueEditorial
  );
}

function shouldHaltDownstream(resolution) {
  return Boolean(resolution && resolution.routing && resolution.routing.haltPipeline);
}

module.exports = {
  DECISION_ROUTING,
  buildRouting,
  shouldRunGenerator,
  shouldRunEditorialQueue,
  shouldHaltDownstream
};
