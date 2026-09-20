const Joi = require("joi");
const {
  ALLOWED_JOB_QUALIFICATIONS,
  ALLOWED_JOB_STATES,
  ALLOWED_JOB_DEPARTMENTS,
  normalizeStateSlug,
  normalizeDepartmentSlug
} = require("../lib/structuredFields");

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
      "latest-job",
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
  /** Board hub filter — must match pages.department (ssc, railway, …) */
  department: Joi.string()
    .trim()
    .max(80)
    .allow("")
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      const normalized = normalizeDepartmentSlug(normalizeFilterValue(value));
      if (normalized && ALLOWED_JOB_DEPARTMENTS.has(normalized)) return normalized;
      return undefined;
    }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

const jobsQuerySchema = Joi.object({
  qualification: optionalWhitelistedString(ALLOWED_JOB_QUALIFICATIONS),
  state: Joi.string()
    .trim()
    .max(80)
    .allow("")
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      const normalized = normalizeStateSlug(normalizeFilterValue(value));
      if (normalized && ALLOWED_JOB_STATES.has(normalized)) return normalized;
      return undefined;
    }),
  department: Joi.string()
    .trim()
    .max(80)
    .allow("")
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      const normalized = normalizeDepartmentSlug(normalizeFilterValue(value));
      if (normalized && ALLOWED_JOB_DEPARTMENTS.has(normalized)) return normalized;
      return undefined;
    }),
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

const relatedClickBodySchema = Joi.object({
  from: Joi.string().trim().min(1).max(255).required(),
  to: Joi.string().trim().min(1).max(255).required()
});

const previewBodySchema = Joi.object({
  title: Joi.string().allow("").max(500).default(""),
  text: Joi.string().allow("").max(500000).default(""),
  post_name: Joi.string().allow("").max(500).optional(),
  total_posts: Joi.alternatives().try(Joi.string().allow(""), Joi.number()).optional(),
  advertisement_no: Joi.string().allow("").max(500).optional(),
  category: Joi.string().allow("").max(200).optional(),
  tag: Joi.string().allow("").max(200).optional(),
  status: Joi.string().allow("").max(200).optional(),
  normalizedStatus: Joi.string().allow("").max(200).optional(),
  // Combined Preview (UPDATE drafts): existing published page + pending update
  existingText: Joi.string().allow("").max(500000).optional(),
  existing_page_text: Joi.string().allow("").max(500000).optional(),
  combinePreview: Joi.boolean().optional(),
  combinedPreview: Joi.boolean().optional(),
  mergeAlreadyApplied: Joi.boolean().optional(),
  oldSlug: Joi.string().allow("").max(255).optional(),
  canonicalSlug: Joi.string().allow("").max(255).optional(),
  sectionDiff: Joi.object({
    added: Joi.array().items(Joi.string().allow("")).optional(),
    modified: Joi.array().items(Joi.string().allow("")).optional(),
    unchanged: Joi.array().items(Joi.string().allow("")).optional(),
    removed: Joi.array().items(Joi.string().allow("")).optional(),
    hasChanges: Joi.boolean().optional()
  })
    .unknown(true)
    .optional()
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
  relatedClickBodySchema,
  previewBodySchema,
  aiParseBodySchema
};
