// routes/reminder.routes.js
const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middlewares/auth");
const {
  getCaretakerDetails,
  getAllFamilyMembers,
  getPatientDetails,
} = require("../controllers/basic.controller");
const { validate, basicDetails } = require("../utils/validators");
const { defaultLimiter } = require("../middlewares/rateLimit");

// Apply rate limiting and authentication to all routes
// router.use(defaultLimiter);
// router.use(protect);

/**
 * @desc    Get Caregiover
 * @route   GET /api/
 * @access  Private (Patient, Family, Caregiver)
 */
router.post("/caregiver",  getCaretakerDetails);

router.post("/family",  getAllFamilyMembers);
router.post("/patient", getPatientDetails);

module.exports = router;
