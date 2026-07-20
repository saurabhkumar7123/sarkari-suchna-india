"use strict";

const { analyzeRecruitmentNoticeInput } = require("../../services/recruitmentTesting.service");
const { lookupRecruitmentCandidates } = require("../../services/recruitmentCandidateLookup.service");
const recruitmentReviewService = require("../../services/recruitmentReview.service");

const analyzeRecruitmentNoticeHandler = async (req, res) => {
  try {
    const analysis = analyzeRecruitmentNoticeInput(req.body);
    res.json({
      success: true,
      data: analysis
    });
  } catch {
    res.status(400).json({
      success: false,
      message: "Analysis could not be completed. Please check your input and try again."
    });
  }
};

const lookupRecruitmentCandidatesHandler = async (req, res) => {
  try {
    const notice =
      req.body && req.body.notice && typeof req.body.notice === "object"
        ? req.body.notice
        : {
            title: req.body?.title,
            content: req.body?.content,
            url: req.body?.url
          };

    const result = await lookupRecruitmentCandidates({ notice });
    res.json({
      success: true,
      data: result
    });
  } catch {
    res.status(400).json({
      success: false,
      message: "Candidate lookup could not be completed. Please check your input and try again."
    });
  }
};

const saveRecruitmentReviewHandler = async (req, res) => {
  try {
    const saved = await recruitmentReviewService.saveReviewItem(req.body);
    res.status(201).json({
      success: true,
      message: "Saved successfully",
      data: saved
    });
  } catch (err) {
    const statusCode = err && err.statusCode ? err.statusCode : 400;
    res.status(statusCode).json({
      success: false,
      message:
        statusCode === 400
          ? err.errors && err.errors.length
            ? `Validation failed: ${err.errors.join("; ")}`
            : err.message || "Validation failed"
          : err.message || "Could not save review item."
    });
  }
};

module.exports = {
  analyzeRecruitmentNoticeHandler,
  lookupRecruitmentCandidatesHandler,
  saveRecruitmentReviewHandler
};
