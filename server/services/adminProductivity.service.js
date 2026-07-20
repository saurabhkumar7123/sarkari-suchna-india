"use strict";

/**
 * Package 4E — Admin productivity summary.
 *
 * Aggregates existing recruitment / editorial / draft / page-link data
 * for dashboard widgets. No background polling, no workers.
 */

const recruitmentRepository = require("../repositories/recruitment.repository");
const recruitmentPageLinkRepository = require("../repositories/recruitmentPageLink.repository");
const editorialReviewRepository = require("../repositories/editorialReview.repository");
const recruitmentDraftBindingService = require("./recruitmentDraftBinding.service");
const {
  WORKFLOW_STATES
} = require("../lib/recruitment/editorialWorkflow");

const PENDING_REVIEW_STATES = Object.freeze([
  WORKFLOW_STATES.REVIEW_PENDING,
  WORKFLOW_STATES.IN_REVIEW
]);

const VALIDATION_WARNING_STATES = Object.freeze([
  WORKFLOW_STATES.CHANGES_REQUESTED,
  WORKFLOW_STATES.REJECTED
]);

async function getProductivitySummary() {
  let activeRecruitments = 0;
  let pendingReviews = 0;
  let draftsWaiting = 0;
  let brokenPageLinks = 0;
  let validationWarnings = 0;
  const available = {
    recruitments: false,
    editorialReviews: true,
    drafts: false,
    pageLinks: false
  };

  try {
    if (await recruitmentRepository.tableExists()) {
      available.recruitments = true;
      activeRecruitments = await recruitmentRepository.countActiveRecruitments();
    }
  } catch {
    activeRecruitments = 0;
  }

  try {
    const reviews = editorialReviewRepository.listReviews({ limit: 100 });
    pendingReviews = reviews.filter((row) =>
      PENDING_REVIEW_STATES.includes(String(row.workflowState || "").toLowerCase())
    ).length;
    validationWarnings = reviews.filter((row) =>
      VALIDATION_WARNING_STATES.includes(String(row.workflowState || "").toLowerCase())
    ).length;
  } catch {
    pendingReviews = 0;
    validationWarnings = 0;
  }

  try {
    const drafts = await recruitmentDraftBindingService.listAvailableDrafts({ limit: 50 });
    draftsWaiting = Array.isArray(drafts) ? drafts.length : 0;
    available.drafts = true;
  } catch {
    draftsWaiting = 0;
  }

  try {
    brokenPageLinks = await recruitmentPageLinkRepository.countBrokenPageLinks();
    available.pageLinks = true;
  } catch {
    brokenPageLinks = 0;
  }

  return {
    pendingReviews,
    activeRecruitments,
    draftsWaiting,
    brokenPageLinks,
    validationWarnings,
    available,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  getProductivitySummary,
  PENDING_REVIEW_STATES,
  VALIDATION_WARNING_STATES
};
