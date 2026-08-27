const Joi = require("joi");
const { sanitizeBadgeCodesForStorage, ALLOWED_BADGE_CODES, HOMEPAGE_BADGE_MAX } = require("../lib/homepageBadges");
const { LIFECYCLE_STATES } = require("../services/recruitment.service");
const { EVENT_TYPES, EVENT_STATUSES } = require("../services/recruitmentEvent.service");
const {
  REVIEW_STATUS_VALUES,
  VALID_EVENT_TYPES
} = require("../lib/recruitment/reviewQueue");

/** Slug segment: non-empty only; empty is validated separately on pageUrl/oldSlug. */
const SLUG_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Manual badge codes admin can attach to a page (homepage row tags only).
 * Canonical list lives in server/lib/homepageBadges.js
 */
const MAX_BADGES_PER_PAGE = HOMEPAGE_BADGE_MAX;

const adminPagePayloadSchema = Joi.object({
  title: Joi.string().trim().max(500).required(),
  slug: Joi.string()
    .trim()
    .lowercase()
    .allow("")
    .optional()
    .custom((val, helpers) => {
      if (val == null || val === "") return "";
      if (!SLUG_SEGMENT.test(val)) {
        return helpers.error("any.invalid", { message: "slug must be a URL-safe slug" });
      }
      return val;
    }),
  pageUrl: Joi.string()
    .trim()
    .lowercase()
    .max(255)
    .allow("", null)
    .optional()
    .custom((val, helpers) => {
      if (val == null || val === "") return "";
      if (!SLUG_SEGMENT.test(val)) {
        return helpers.error("any.invalid", { message: "pageUrl must be a URL-safe slug" });
      }
      return val;
    }),
  content: Joi.string().trim().min(1).required(),
  text: Joi.string().trim().allow(null, "").optional(),
  category: Joi.string().trim().max(100).allow("", null).optional(),
  links: Joi.array().items(Joi.string().uri({ scheme: ["http", "https"] })).default([]),
  status: Joi.string().trim().max(64).allow("", null).optional(),
  oldSlug: Joi.string().trim().max(255).allow("", null).optional(),
  /* Empty string = new page; number = existing id */
  id: Joi.alternatives(
    Joi.string().trim().max(20).allow(""),
    Joi.number().integer().positive()
  ).optional(),
  qualification: Joi.string().trim().max(120).allow("", null).optional(),
  state: Joi.string().trim().max(120).allow("", null).optional(),
  department: Joi.string().trim().max(120).allow("", null).optional(),
  structuredQualification: Joi.string().trim().max(120).allow("", null).optional(),
  structuredState: Joi.string().trim().max(120).allow("", null).optional(),
  structuredDepartment: Joi.string().trim().max(120).allow("", null).optional(),
  post_name: Joi.string().trim().max(512).allow("", null).optional(),
  postName: Joi.string().trim().max(512).allow("", null).optional(),
  total_posts: Joi.string().trim().max(64).allow("", null).optional(),
  totalPosts: Joi.string().trim().max(64).allow("", null).optional(),
  advertisement_no: Joi.string().trim().max(128).allow("", null).optional(),
  advertisementNo: Joi.string().trim().max(128).allow("", null).optional(),
  lastDate: Joi.alternatives(Joi.date(), Joi.string().trim().allow(""), Joi.valid(null))
    .optional()
    .custom((v) => {
      if (v === "" || v == null) return null;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v).trim();
    }, "lastDate"),
  position: Joi.string().trim().max(20).allow("", null).optional(),
  smallBoxSlot: Joi.alternatives()
    .try(
      Joi.number().integer().min(1).max(8),
      Joi.string().trim().valid("1", "2", "3", "4", "5", "6", "7", "8", ""),
      Joi.valid(null)
    )
    .optional()
    .custom((v, helpers) => {
      if (v === undefined || v === null || v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 8) {
        return helpers.error("any.invalid", {
          message: "smallBoxSlot must be 1–8 or empty"
        });
      }
      return n;
    }, "smallBoxSlot"),
  breaking: Joi.boolean().optional(),
  breakingOrder: Joi.alternatives()
    .try(Joi.number(), Joi.string().allow(""))
    .optional()
    .custom((v, helpers) => {
      if (v === undefined || v === null || v === "") return 0;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return helpers.error("any.invalid", { message: "breakingOrder must be a non-negative integer" });
      }
      return n;
    }, "breakingOrder"),
  eventTime: Joi.string().trim().allow("", null).optional(),
  /**
   * Optional manual badges. Backward compatible: missing / null / "" / [] all
   * resolve to no badges. Server stores as JSON array of uppercase codes.
   * Items outside the whitelist are silently dropped to keep old admin clients
   * sending unknown codes from breaking the save flow.
   */
  badges: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim().uppercase().max(32)),
      Joi.string().trim().allow(""),
      Joi.valid(null)
    )
    .optional()
    .custom((value) => sanitizeBadgeCodesForStorage(value), "badges"),
  generatorDraftId: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.string().trim().allow(""))
    .optional(),
  recruitment_id: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.string().trim().allow(""), Joi.valid(null))
    .optional(),
  recruitment_event_id: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.string().trim().allow(""), Joi.valid(null))
    .optional()
})
  .required()
  .custom((value) => value)
  .messages({
    "any.invalid": "{{#message}}"
  })
  .unknown(false);

const adminLoginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(80).required(),
  password: Joi.string().min(6).max(128).required()
}).required().unknown(false);

const analyzeContentBodySchema = Joi.object({
  text: Joi.string().allow("").max(500000).default(""),
  content: Joi.string().allow("").max(500000).default("")
}).default({});

const emptyBodySchema = Joi.object({}).required().unknown(false);
const adminLogoutSchema = Joi.object({
  logoutAll: Joi.boolean().optional()
}).optional().default({}).unknown(false);

const homepageBreakingPatchSchema = Joi.object({
  breaking: Joi.boolean().required(),
  breakingOrder: Joi.alternatives()
    .try(Joi.number(), Joi.string().allow(""))
    .optional()
    .custom((v) => {
      if (v === undefined || v === null || v === "") return 0;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error("breakingOrder must be a non-negative integer");
      }
      return Math.floor(n);
    }, "breakingOrder")
})
  .required()
  .unknown(false);

const homepageBadgesPatchSchema = Joi.object({
  badges: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim().uppercase().max(32)),
      Joi.string().trim().allow(""),
      Joi.valid(null)
    )
    .optional()
    .custom((value) => sanitizeBadgeCodesForStorage(value), "badges")
})
  .required()
  .unknown(false);

const homepageSmallBoxPatchSchema = Joi.object({
  smallBoxSlot: Joi.alternatives()
    .try(
      Joi.number().integer().min(1).max(8),
      Joi.string().trim().valid("1", "2", "3", "4", "5", "6", "7", "8", "", "normal"),
      Joi.valid(null)
    )
    .required()
})
  .required()
  .unknown(false);

const homepageSmallBoxSlotPatchSchema = Joi.object({
  slug: Joi.alternatives()
    .try(
      Joi.string().trim().pattern(/^[a-z0-9][a-z0-9._-]*$/i),
      Joi.string().trim().valid(""),
      Joi.valid(null)
    )
    .required()
})
  .required()
  .unknown(false);

const recruitmentCreateSchema = Joi.object({
  title: Joi.string().trim().min(1).max(500).required(),
  slug: Joi.string().trim().min(1).max(255).required(),
  department: Joi.string().trim().max(128).allow("", null).optional(),
  post_name: Joi.string().trim().max(512).allow("", null).optional(),
  advertisement_no: Joi.string().trim().max(128).allow("", null).optional(),
  cycle_year: Joi.alternatives()
    .try(Joi.number().integer().min(1900).max(9999), Joi.string().trim().allow(""), Joi.valid(null))
    .optional(),
  lifecycle_state: Joi.string()
    .trim()
    .lowercase()
    .valid(...LIFECYCLE_STATES)
    .optional()
})
  .required()
  .unknown(false);

const recruitmentUpdateSchema = Joi.object({
  title: Joi.string().trim().min(1).max(500).optional(),
  slug: Joi.string().trim().min(1).max(255).optional(),
  department: Joi.string().trim().max(128).allow("", null).optional(),
  post_name: Joi.string().trim().max(512).allow("", null).optional(),
  advertisement_no: Joi.string().trim().max(128).allow("", null).optional(),
  cycle_year: Joi.alternatives()
    .try(Joi.number().integer().min(1900).max(9999), Joi.string().trim().allow(""), Joi.valid(null))
    .optional(),
  lifecycle_state: Joi.string()
    .trim()
    .lowercase()
    .valid(...LIFECYCLE_STATES)
    .optional()
})
  .min(1)
  .required()
  .unknown(false);

const recruitmentListQuerySchema = Joi.object({
  page: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().trim()).optional(),
  limit: Joi.alternatives().try(Joi.number().integer().min(1).max(50), Joi.string().trim()).optional(),
  search: Joi.string().trim().max(200).allow("").optional(),
  cycle_year: Joi.alternatives()
    .try(Joi.number().integer().min(1900).max(9999), Joi.string().trim().allow(""))
    .optional(),
  lifecycle_state: Joi.string()
    .trim()
    .lowercase()
    .valid(...LIFECYCLE_STATES)
    .optional()
})
  .optional()
  .default({})
  .unknown(false);

const recruitmentEventCreateSchema = Joi.object({
  event_type: Joi.string()
    .trim()
    .lowercase()
    .valid(...EVENT_TYPES)
    .required(),
  sequence_order: Joi.alternatives()
    .try(Joi.number().integer().min(0).max(65535), Joi.string().trim())
    .optional(),
  status: Joi.string()
    .trim()
    .lowercase()
    .valid(...EVENT_STATUSES)
    .optional()
})
  .required()
  .unknown(false);

const recruitmentEventUpdateSchema = Joi.object({
  event_type: Joi.string()
    .trim()
    .lowercase()
    .valid(...EVENT_TYPES)
    .optional(),
  sequence_order: Joi.alternatives()
    .try(Joi.number().integer().min(0).max(65535), Joi.string().trim())
    .optional(),
  status: Joi.string()
    .trim()
    .lowercase()
    .valid(...EVENT_STATUSES)
    .optional()
})
  .min(1)
  .required()
  .unknown(false);

const recruitmentEventListQuerySchema = Joi.object({
  page: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().trim()).optional(),
  limit: Joi.alternatives().try(Joi.number().integer().min(1).max(50), Joi.string().trim()).optional(),
  status: Joi.string()
    .trim()
    .lowercase()
    .valid(...EVENT_STATUSES)
    .optional()
})
  .optional()
  .default({})
  .unknown(false);

const pageLinkagePageRefSchema = Joi.object({
  page_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim()).optional(),
  slug: Joi.string().trim().min(1).max(255).optional()
})
  .or("page_id", "slug")
  .required()
  .unknown(false);

const pageLinkageLinkSchema = Joi.object({
  page_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim()).optional(),
  slug: Joi.string().trim().min(1).max(255).optional(),
  recruitment_id: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.string().trim())
    .required(),
  recruitment_event_id: Joi.alternatives()
    .try(
      Joi.number().integer().positive(),
      Joi.string().trim().allow(""),
      Joi.valid(null)
    )
    .optional()
})
  .or("page_id", "slug")
  .required()
  .unknown(false);

const pageLinkageListQuerySchema = Joi.object({
  recruitment_id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim()).optional(),
  recruitment_event_id: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.string().trim())
    .optional(),
  page: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().trim()).optional(),
  limit: Joi.alternatives().try(Joi.number().integer().min(1).max(50), Joi.string().trim()).optional()
})
  .xor("recruitment_id", "recruitment_event_id")
  .required()
  .unknown(false);

const recruitmentTestingYearSchema = Joi.alternatives()
  .try(
    Joi.number().integer().min(1900).max(9999),
    Joi.string().trim().pattern(/^(19|20)\d{2}$/)
  )
  .allow(null, "")
  .optional();

const recruitmentTestingCandidateSchema = Joi.object({
  id: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim()).optional(),
  department: Joi.string().trim().max(128).allow("", null).optional(),
  board: Joi.string().trim().max(128).allow("", null).optional(),
  organization: Joi.string().trim().max(128).allow("", null).optional(),
  post_name: Joi.string().trim().max(512).allow("", null).optional(),
  exam_name: Joi.string().trim().max(128).allow("", null).optional(),
  advertisement_no: Joi.string().trim().max(128).allow("", null).optional(),
  cycle_year: recruitmentTestingYearSchema,
  recruitment_year: recruitmentTestingYearSchema,
  title: Joi.string().trim().max(500).allow("", null).optional(),
  slug: Joi.string().trim().max(255).allow("", null).optional()
})
  .unknown(true)
  .messages({
    "object.base": "Each candidate recruitment must be an object"
  });

const recruitmentTestingAnalyzeSchema = Joi.object({
  title: Joi.string().trim().max(500).allow("", null).optional(),
  content: Joi.string().trim().max(20000).allow("", null).optional(),
  url: Joi.string().trim().max(2000).allow("", null).optional(),
  candidateRecruitments: Joi.array()
    .items(recruitmentTestingCandidateSchema)
    .default([])
    .custom((value, helpers) => {
      for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        if (item === null || typeof item !== "object" || Array.isArray(item)) {
          return helpers.message(`candidateRecruitments[${index}] must be an object`);
        }
      }
      return value;
    }),
  createdAt: Joi.string().trim().isoDate().optional()
})
  .custom((value, helpers) => {
    const title = String(value.title || "").trim();
    const content = String(value.content || "").trim();
    const url = String(value.url || "").trim();
    if (!title && !content && !url) {
      return helpers.message("At least one of title, content, or url is required");
    }
    return value;
  })
  .unknown(false);

const recruitmentTestingLookupSchema = Joi.object({
  title: Joi.string().trim().max(500).allow("", null).optional(),
  content: Joi.string().trim().max(20000).allow("", null).optional(),
  url: Joi.string().trim().max(2000).allow("", null).optional(),
  notice: Joi.object({
    title: Joi.string().trim().max(500).allow("", null).optional(),
    content: Joi.string().trim().max(20000).allow("", null).optional(),
    url: Joi.string().trim().max(2000).allow("", null).optional()
  })
    .unknown(false)
    .optional()
})
  .custom((value, helpers) => {
    const source = value.notice && typeof value.notice === "object" ? value.notice : value;
    const title = String(source.title || "").trim();
    const content = String(source.content || "").trim();
    const url = String(source.url || "").trim();
    if (!title && !content && !url) {
      return helpers.message("At least one of title, content, or url is required");
    }
    return value;
  })
  .unknown(false);

const recruitmentTestingSaveReviewSchema = Joi.object({
  reviewItem: Joi.object({
    recruitmentId: Joi.alternatives()
      .try(Joi.number().integer().positive(), Joi.string().trim(), Joi.valid(null))
      .optional(),
    recruitment_id: Joi.alternatives()
      .try(Joi.number().integer().positive(), Joi.string().trim(), Joi.valid(null))
      .optional(),
    eventType: Joi.string().trim().max(64).optional(),
    event_type: Joi.string().trim().max(64).optional(),
    matchResult: Joi.object().unknown(true).allow(null).optional(),
    match_result: Joi.object().unknown(true).allow(null).optional(),
    confidence: Joi.string().trim().max(16).allow("", null).optional(),
    sourceUrl: Joi.string().trim().max(2000).allow("", null).optional(),
    source_url: Joi.string().trim().max(2000).allow("", null).optional(),
    title: Joi.string().trim().max(500).required(),
    createdAt: Joi.string().trim().allow("", null).optional(),
    created_at: Joi.string().trim().allow("", null).optional(),
    notes: Joi.string().trim().max(5000).allow("", null).optional(),
    status: Joi.string().trim().max(32).optional(),
    decision: Joi.string().trim().max(32).optional(),
    frozen: Joi.boolean().optional()
  })
    .required()
    .unknown(true),
  raw_notice: Joi.object().unknown(true).allow(null).optional(),
  rawNotice: Joi.object().unknown(true).allow(null).optional(),
  normalized_notice: Joi.alternatives()
    .try(Joi.object().unknown(true), Joi.string().trim().max(20000))
    .allow(null)
    .optional(),
  normalizedNotice: Joi.alternatives()
    .try(Joi.object().unknown(true), Joi.string().trim().max(20000))
    .allow(null)
    .optional(),
  processor_output: Joi.object().unknown(true).allow(null).optional(),
  processorOutput: Joi.object().unknown(true).allow(null).optional(),
  finalStatus: Joi.string().trim().max(64).allow("", null).optional(),
  warnings: Joi.array().items(Joi.string().trim().max(128)).optional(),
  update_id: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.valid(null))
    .optional(),
  recruitment_event_id: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.valid(null))
    .optional()
}).unknown(false);

const recruitmentReviewQueueListQuerySchema = Joi.object({
  page: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().trim()).optional(),
  limit: Joi.alternatives().try(Joi.number().integer().min(1).max(50), Joi.string().trim()).optional(),
  status: Joi.string()
    .trim()
    .lowercase()
    .valid(...REVIEW_STATUS_VALUES)
    .optional(),
  event_type: Joi.string()
    .trim()
    .lowercase()
    .valid(...VALID_EVENT_TYPES)
    .optional(),
  recruitment_id: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.string().trim().allow(""))
    .optional(),
  search: Joi.string().trim().max(500).allow("").optional()
})
  .optional()
  .default({})
  .unknown(false);

const recruitmentReviewQueueActionSchema = Joi.object({
  notes: Joi.string().trim().max(5000).allow("", null).optional()
})
  .optional()
  .default({})
  .unknown(false);

const recruitmentReviewQueueNotesSchema = Joi.object({
  notes: Joi.string().trim().max(5000).allow("", null).required()
})
  .required()
  .unknown(false);

const recruitmentReviewQueueResolveSchema = Joi.object({
  action: Joi.string().trim().lowercase().valid("attach", "create_parent", "standalone", "reject").required(),
  recruitment_id: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.string().trim().allow(""), Joi.valid(null))
    .optional(),
  event_type: Joi.string()
    .trim()
    .lowercase()
    .valid(...VALID_EVENT_TYPES)
    .optional(),
  notes: Joi.string().trim().max(5000).allow("", null).optional()
})
  .required()
  .unknown(false);

const recruitmentManualUpdateSchema = Joi.object({
  event_type: Joi.string()
    .trim()
    .lowercase()
    .valid(...VALID_EVENT_TYPES)
    .required(),
  title: Joi.string().trim().max(500).required(),
  payload: Joi.object().unknown(true).optional()
})
  .required()
  .unknown(false);

const recruitmentRuntimePreviewListQuerySchema = Joi.object({
  page: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().trim()).optional(),
  limit: Joi.alternatives().try(Joi.number().integer().min(1).max(50), Joi.string().trim()).optional(),
  event_type: Joi.string()
    .trim()
    .lowercase()
    .valid(...VALID_EVENT_TYPES)
    .optional(),
  site: Joi.string().trim().max(500).allow("").optional(),
  site_id: Joi.alternatives()
    .try(Joi.number().integer().positive(), Joi.string().trim().allow(""))
    .optional()
})
  .optional()
  .default({})
  .unknown(false);

const positiveIdField = Joi.alternatives()
  .try(Joi.number().integer().positive(), Joi.string().trim().pattern(/^[1-9]\d*$/))
  .required();

const optionalPositiveIdField = Joi.alternatives()
  .try(
    Joi.number().integer().positive(),
    Joi.string().trim().pattern(/^[1-9]\d*$/),
    Joi.valid(null, "")
  )
  .optional()
  .allow(null, "");

const recruitmentDraftAttachSchema = Joi.object({
  draft_id: positiveIdField,
  recruitment_event_id: optionalPositiveIdField
})
  .required()
  .unknown(false);

const recruitmentDraftDetachSchema = Joi.object({
  draft_id: optionalPositiveIdField
})
  .optional()
  .default({})
  .unknown(false);

const recruitmentDraftReplaceSchema = Joi.object({
  draft_id: positiveIdField,
  previous_draft_id: optionalPositiveIdField,
  recruitment_event_id: optionalPositiveIdField
})
  .required()
  .unknown(false);

const editorialReviewDecisionSchema = Joi.object({
  decision: Joi.string()
    .trim()
    .lowercase()
    .valid(
      "submit_for_review",
      "start_review",
      "approve",
      "request_changes",
      "reject",
      "return_to_draft",
      "reopen_review"
    )
    .required(),
  comment: Joi.string().trim().max(5000).allow("", null).optional(),
  notes: Joi.string().trim().max(5000).allow("", null).optional()
})
  .required()
  .unknown(false);

const editorialReviewNoteSchema = Joi.object({
  text: Joi.string().trim().max(5000).allow("").optional(),
  notes: Joi.string().trim().max(5000).allow("").optional(),
  comment: Joi.string().trim().max(5000).allow("").optional()
})
  .or("text", "notes", "comment")
  .required()
  .unknown(false);

const sharedPreviewRefreshSchema = Joi.object({
  reason: Joi.string()
    .trim()
    .lowercase()
    .valid(
      "manual",
      "recruitment_update",
      "draft_change",
      "review_decision",
      "page_link_change"
    )
    .allow("", null)
    .optional()
})
  .optional()
  .default({})
  .unknown(false);

const recruitmentBulkSchema = Joi.object({
  action: Joi.string()
    .trim()
    .lowercase()
    .valid("archive", "restore", "status_update", "category_update", "assignment", "delete")
    .required(),
  ids: Joi.array()
    .items(Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().trim()))
    .min(1)
    .max(50)
    .required(),
  confirm: Joi.boolean().valid(true).required(),
  lifecycle_state: Joi.string()
    .trim()
    .lowercase()
    .valid(...LIFECYCLE_STATES)
    .optional(),
  category: Joi.string().trim().max(128).allow("", null).optional(),
  department: Joi.string().trim().max(128).allow("", null).optional(),
  assignee: Joi.string().trim().max(128).allow("", null).optional()
})
  .required()
  .unknown(false);

const pageBulkRegenerateSchema = Joi.object({
  slugs: Joi.array().items(Joi.string().trim().min(1).max(255)).min(1).max(40).required(),
  confirm: Joi.boolean().valid(true).required()
})
  .required()
  .unknown(false);

const automationSourceListQuerySchema = Joi.object({
  page: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().trim()).optional(),
  limit: Joi.alternatives().try(Joi.number().integer().min(1).max(100), Joi.string().trim()).optional(),
  search: Joi.string().trim().max(200).allow("").optional(),
  q: Joi.string().trim().max(200).allow("").optional(),
  department: Joi.string().trim().max(120).allow("").optional(),
  health: Joi.string().trim().max(40).allow("").optional(),
  enabled: Joi.alternatives().try(Joi.boolean(), Joi.string().trim().allow("")).optional()
})
  .optional()
  .default({})
  .unknown(false);

const automationSourceUpsertSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160).required(),
  monitoringUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).optional(),
  notificationUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).optional(),
  url: Joi.string().trim().uri({ scheme: ["http", "https"] }).optional(),
  selector: Joi.string().trim().max(255).allow("", null).optional(),
  priority: Joi.string().trim().uppercase().valid("P0", "P1", "P2", "P3").optional(),
  enabled: Joi.boolean().optional()
})
  .or("monitoringUrl", "notificationUrl", "url")
  .required()
  .unknown(false);

const automationSettingsUpdateSchema = Joi.object({
  confidenceThreshold: Joi.number().integer().min(0).max(100).optional(),
  riskThreshold: Joi.number().integer().min(0).max(100).optional(),
  reviewRules: Joi.string().trim().max(5000).allow("").optional(),
  draftRules: Joi.string().trim().max(5000).allow("").optional(),
  recoveryRules: Joi.string().trim().max(5000).allow("").optional(),
  departmentRules: Joi.string().trim().max(5000).allow("").optional()
})
  .min(1)
  .required()
  .unknown(false);

const automationWorkflowListQuerySchema = Joi.object({
  page: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().trim()).optional(),
  limit: Joi.alternatives().try(Joi.number().integer().min(1).max(100), Joi.string().trim()).optional(),
  status: Joi.string().trim().max(64).allow("").optional(),
  search: Joi.string().trim().max(200).allow("").optional()
})
  .optional()
  .default({})
  .unknown(false);

const automationAuditListQuerySchema = Joi.object({
  page: Joi.alternatives().try(Joi.number().integer().min(1), Joi.string().trim()).optional(),
  limit: Joi.alternatives().try(Joi.number().integer().min(1).max(100), Joi.string().trim()).optional(),
  search: Joi.string().trim().max(200).allow("").optional()
})
  .optional()
  .default({})
  .unknown(false);

const automationControlsUpdateSchema = Joi.object({
  schedulerEnabled: Joi.boolean().optional(),
  telegramEnabled: Joi.boolean().optional()
})
  .or("schedulerEnabled", "telegramEnabled")
  .required()
  .unknown(false);

module.exports = {
  adminPagePayloadSchema,
  adminLoginSchema,
  analyzeContentBodySchema,
  emptyBodySchema,
  adminLogoutSchema,
  homepageBreakingPatchSchema,
  homepageBadgesPatchSchema,
  homepageSmallBoxPatchSchema,
  homepageSmallBoxSlotPatchSchema,
  recruitmentCreateSchema,
  recruitmentUpdateSchema,
  recruitmentListQuerySchema,
  recruitmentEventCreateSchema,
  recruitmentEventUpdateSchema,
  recruitmentEventListQuerySchema,
  pageLinkageLinkSchema,
  pageLinkagePageRefSchema,
  pageLinkageListQuerySchema,
  recruitmentTestingAnalyzeSchema,
  recruitmentTestingLookupSchema,
  recruitmentTestingSaveReviewSchema,
  recruitmentReviewQueueListQuerySchema,
  recruitmentReviewQueueActionSchema,
  recruitmentReviewQueueNotesSchema,
  recruitmentReviewQueueResolveSchema,
  recruitmentManualUpdateSchema,
  recruitmentRuntimePreviewListQuerySchema,
  recruitmentDraftAttachSchema,
  recruitmentDraftDetachSchema,
  recruitmentDraftReplaceSchema,
  editorialReviewDecisionSchema,
  editorialReviewNoteSchema,
  sharedPreviewRefreshSchema,
  recruitmentBulkSchema,
  pageBulkRegenerateSchema,
  automationSourceListQuerySchema,
  automationSourceUpsertSchema,
  automationSettingsUpdateSchema,
  automationWorkflowListQuerySchema,
  automationAuditListQuerySchema,
  automationControlsUpdateSchema,
  ALLOWED_BADGE_CODES,
  MAX_BADGES_PER_PAGE
};
