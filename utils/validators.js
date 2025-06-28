// utils/validators.js
const { check, validationResult } = require("express-validator");

// Validation middleware handler
exports.validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  };
};
exports.reminderValidator = [
  check("title", "Title is required").not().isEmpty().trim().escape(),
  check("description", "Description is required")
    .not()
    .isEmpty()
    .trim()
    .escape(),
  check("scheduledTime", "Valid scheduled time is required")
    .isISO8601()
    .toDate(),
  check("recurrence", "Recurrence must be none, daily, weekly, or monthly")
    .optional()
    .isIn(["none", "daily", "weekly", "monthly"]),
  check("patient", "Patient ID must be valid").optional().isMongoId(),
];

exports.updateReminderValidator = [
  check("title", "Title is required")
    .optional()
    .not()
    .isEmpty()
    .trim()
    .escape(),
  check("description", "Description is required")
    .optional()
    .not()
    .isEmpty()
    .trim()
    .escape(),
  check("scheduledTime", "Valid scheduled time is required")
    .optional()
    .isISO8601()
    .toDate(),
  check("recurrence", "Recurrence must be none, daily, weekly, or monthly")
    .optional()
    .isIn(["none", "daily", "weekly", "monthly"]),
  check("status", "Status must be scheduled or cancelled")
    .optional()
    .isIn(["scheduled", "cancelled"]),
];
// Auth validators
exports.registerValidator = [
  check("name")
    .trim()
    .not()
    .isEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

  check("email")
    .trim()
    .not()
    .isEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please include a valid email")
    .normalizeEmail(),

  check("password")
    .trim()
    .not()
    .isEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/\d/)
    .withMessage("Password must contain a number"),

  check("userType")
    .isIn(["patient", "caregiver", "family"])
    .withMessage("User type must be patient, caregiver, or family"),
];
exports.locationValidator = [
  check("latitude")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),
  check("longitude")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),
  check("updatedAt").optional().isISO8601().withMessage("Invalid date format"),
];
exports.loginValidator = [
  check("email")
    .trim()
    .not()
    .isEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please include a valid email"),

  check("password").trim().not().isEmpty().withMessage("Password is required"),
];

// Device validators
exports.deviceValidator = [
  check("deviceId")
    .trim()
    .not()
    .isEmpty()
    .withMessage("Device ID is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Device ID must be between 5 and 50 characters"),
];

// Reminder validators
exports.reminderValidator = [
  check("title")
    .trim()
    .not()
    .isEmpty()
    .withMessage("Title is required")
    .isLength({ max: 100 })
    .withMessage("Title cannot exceed 100 characters"),

  check("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  check("scheduledTime")
    .not()
    .isEmpty()
    .withMessage("Scheduled time is required")
    .custom((value) => {
      const scheduledTime = new Date(value);
      const now = new Date();

      if (scheduledTime < now) {
        throw new Error("Scheduled time must be in the future");
      }
      return true;
    }),

  check("recurrence")
    .isIn(["none", "daily", "weekly", "monthly"])
    .withMessage("Recurrence must be none, daily, weekly, or monthly"),

  check("patient")
    .optional()
    .isMongoId()
    .withMessage("Invalid patient ID format"),
];

// Caregiver/family validators
exports.caregiverValidator = [
  check("patient")
    .not()
    .isEmpty()
    .withMessage("Patient ID is required")
    .isMongoId()
    .withMessage("Invalid patient ID format"),
];

exports.familyValidator = [
  check("patient")
    .not()
    .isEmpty()
    .withMessage("Patient ID is required")
    .isMongoId()
    .withMessage("Invalid patient ID format"),

  check("relationship")
    .not()
    .isEmpty()
    .withMessage("Relationship is required")
    .isLength({ max: 50 })
    .withMessage("Relationship cannot exceed 50 characters"),
];

exports.basicDetails = [
  check("patientId")
    .isEmpty()
    .withMessage("Patient ID is required")
    .isMongoId()
    .withMessage("Invalid patient ID format"),
];
