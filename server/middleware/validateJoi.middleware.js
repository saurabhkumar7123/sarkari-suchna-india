function validateJoi(schema, property = "body") {
  const REDACT_FIELDS = new Set([
    "password",
    "token",
    "access_token",
    "refresh_token",
    "cookie",
    "authorization"
  ]);

  function redactValue(key, value) {
    if (REDACT_FIELDS.has(String(key || "").toLowerCase())) return "[REDACTED]";
    if (value == null) return value;
    if (typeof value === "object") {
      if (Array.isArray(value)) return value.map((v) => redactValue("", v));
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = redactValue(k, v);
      }
      return out;
    }
    return value;
  }

  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      if (process.env.NODE_ENV !== "production") {
        console.log("REQ BODY (sanitized):", JSON.stringify(redactValue("", req.body), null, 2));
        console.log(
          "JOI ERRORS FULL:",
          error.details.map((d) => ({
            field: d.path.join("."),
            message: d.message,
            value: redactValue(d.path.join("."), d.context?.value)
          }))
        );
      }
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((d) => ({
          field: d.path.join("."),
          message: d.message
        }))
      });
    }

    req[property] = value;
    next();
  };
}

module.exports = validateJoi;
