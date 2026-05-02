const Joi = require("joi");

/** Slug segment: non-empty only; empty is validated separately on pageUrl/oldSlug. */
const SLUG_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const adminPagePayloadSchema = Joi.object({
  title: Joi.string().trim().max(150).required(),
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
  lastDate: Joi.alternatives(Joi.date(), Joi.string().trim().allow(""), Joi.valid(null))
    .optional()
    .custom((v) => {
      if (v === "" || v == null) return null;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v).trim();
    }, "lastDate"),
  position: Joi.string().trim().max(20).allow("", null).optional(),
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
  eventTime: Joi.string().trim().allow("", null).optional()
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

const emptyBodySchema = Joi.object({}).required().unknown(false);
const adminLogoutSchema = Joi.object({
  logoutAll: Joi.boolean().optional()
}).optional().default({}).unknown(false);

module.exports = {
  adminPagePayloadSchema,
  adminLoginSchema,
  emptyBodySchema,
  adminLogoutSchema
};
