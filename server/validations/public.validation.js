const Joi = require("joi");

/** Lowercase values aligned with finder / admin / DB */
const ALLOWED_JOB_QUALIFICATIONS = new Set([
  "10th",
  "12th",
  "diploma",
  "graduation",
  "post graduation",
  "phd"
]);

const ALLOWED_JOB_STATES = new Set([
  "all india",
  "uttar pradesh",
  "bihar",
  "madhya pradesh",
  "rajasthan",
  "other",
  "delhi",
  "uttarakhand"
]);

const ALLOWED_JOB_DEPARTMENTS = new Set([
  "police",
  "railway",
  "bank",
  "ssc",
  "upsc",
  "teaching",
  "defence",
  "health"
]);

function normalizeFilterValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Invalid or empty values become undefined (filter ignored). No validation errors.
 * @param {Set<string>} allowed
 */
function optionalWhitelistedString(allowed) {
  return Joi.string()
    .trim()
    .max(80)
    .allow("")
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      const normalized = normalizeFilterValue(value);
      if (allowed.has(normalized)) return normalized;
      return undefined;
    });
}

const pagesListQuerySchema = Joi.object({
  status: Joi.string().trim().max(64).allow("").optional(),
  section: Joi.string()
    .valid(
      "new-form",
      "admission",
      "result",
      "admit-card",
      "answer-key",
      "syllabus",
      "document"
    )
    .optional(),
  /** Alias for section (e.g. type=new-form); normalized in controller */
  type: Joi.string().trim().max(32).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

const jobsQuerySchema = Joi.object({
  qualification: optionalWhitelistedString(ALLOWED_JOB_QUALIFICATIONS),
  state: optionalWhitelistedString(ALLOWED_JOB_STATES),
  department: optionalWhitelistedString(ALLOWED_JOB_DEPARTMENTS),
  jobType: Joi.string().trim().max(80).allow("").optional(),
  status: Joi.string().trim().max(80).allow("").optional(),
  source: Joi.string().trim().valid("finder").optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10)
});

const jobIdParamSchema = Joi.object({
  id: Joi.string().trim().pattern(/^(job_\d+|\d+)$/).required()
});

const slugParamSchema = Joi.object({
  slug: Joi.string().trim().min(1).max(255).required()
});

const searchQuerySchema = Joi.object({
  q: Joi.string().trim().max(120).allow("").default("")
});

const tagParamSchema = Joi.object({
  tag: Joi.string().trim().min(1).max(80).required()
});

const relatedSlugParamSchema = Joi.object({
  slug: Joi.string().trim().min(1).max(255).required()
});

const previewBodySchema = Joi.object({
  title: Joi.string().allow("").max(500).default(""),
  text: Joi.string().allow("").max(500000).default("")
});

const aiParseBodySchema = Joi.object({
  text: Joi.string().allow("").max(500000).default(""),
  content: Joi.string().allow("").max(500000).default(""),
  payloadText: Joi.string().allow("").max(500000).default(""),
  rawText: Joi.string().allow("").max(500000).default(""),
  data: Joi.string().allow("").max(500000).default("")
});

module.exports = {
  pagesListQuerySchema,
  jobsQuerySchema,
  ALLOWED_JOB_QUALIFICATIONS,
  ALLOWED_JOB_STATES,
  ALLOWED_JOB_DEPARTMENTS,
  jobIdParamSchema,
  slugParamSchema,
  searchQuerySchema,
  tagParamSchema,
  relatedSlugParamSchema,
  previewBodySchema,
  aiParseBodySchema
};
