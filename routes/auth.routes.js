// routes/auth.routes.js
const express = require("express");
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
} = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth");
const {
  validate,
  registerValidator,
  loginValidator,
} = require("../utils/validators");
const { authLimiter } = require("../middlewares/rateLimit");

const router = express.Router();

// Apply rate limiting to auth routes
// router.use(authLimiter);

// Public routes
router.post("/register", validate(registerValidator), register);
// router.post("/register", register);
router.post("/login", validate(loginValidator), login);

// Protected routes
router.use(protect);
router.get("/me", getMe);
router.put("/profile", updateProfile);
router.put("/password", changePassword);

module.exports = router;
