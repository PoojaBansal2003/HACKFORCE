const express = require("express");
const { protect } = require("../middlewares/auth");
const {
  getProfile,
  updateProfile,
  linkPatientToFamily,
} = require("../controllers/user.controller");

const router = express.Router();

router.use(protect);

router.route("/me").get(getProfile).put(updateProfile);

router.route("/link-patient").post(linkPatientToFamily);

module.exports = router;
