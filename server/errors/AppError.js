class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {boolean} [isOperational=true]
   */
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
