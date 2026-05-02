/**
 * @param {import('joi').ObjectSchema} schema
 * @param {'query'|'body'|'params'} property
 */
function validate(schema, property = "query") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((d) => d.message).join("; ")
      });
    }
    req[property] = value;
    next();
  };
}

module.exports = validate;
