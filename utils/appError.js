// utils/appError.js
class AppError extends Error {
  /**
   * Create custom application error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Array} errors - Optional array of validation errors
   * @param {string} stack - Error stack trace
   */
  constructor(message, statusCode, errors = [], stack = "") {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }

    // Log the error creation (optional)
    if (process.env.NODE_ENV === "development") {
      console.error(this);
    }
  }

  /**
   * Create a validation error
   * @param {Array} errors - Array of validation errors
   * @returns {AppError}
   */
  static validationError(errors) {
    return new AppError("Validation failed", 400, errors);
  }

  /**
   * Create a not found error
   * @param {string} message - Custom not found message
   * @returns {AppError}
   */
  static notFound(message = "Resource not found") {
    return new AppError(message, 404);
  }

  /**
   * Create an unauthorized error
   * @param {string} message - Custom unauthorized message
   * @returns {AppError}
   */
  static unauthorized(message = "Not authorized") {
    return new AppError(message, 401);
  }

  /**
   * Create a forbidden error
   * @param {string} message - Custom forbidden message
   * @returns {AppError}
   */
  static forbidden(message = "Forbidden") {
    return new AppError(message, 403);
  }
}

module.exports = AppError;
