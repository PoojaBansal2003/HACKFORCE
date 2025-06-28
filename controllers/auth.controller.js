// controllers/auth.controller.js
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Patient = require("../models/patient.model");
const Caregiver = require("../models/caregiver.model");
const Family = require("../models/family.model");
const config = require("../config/config");
const logger = require("../utils/logger");

// Helper function to generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE,
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    console.log("register started ");
    const { name, email, password, phone, userType, ...additionalData } =
      req.body;
    console.log(req.body);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Email already in use",
      });
    }

    // Create base user
    const userData = {
      name,
      email,
      password,
      userType,
      phone,
    };

    // Create user based on type
    let user;
    let extraData;

    switch (
      userType.toLowerCase() // Convert to lowercase to handle case variations
    ) {
      case "patient":
        user = await Patient.create({
          ...userData,
          ...additionalData,
        });
        break;
      case "caregiver":
        // user = await User.create(userData);
        // If caregiver, check if patient email is provided
        console.log("dawkhjdkwqhdihqwiudhiqwd");
        if (additionalData.patientEmail) {
          // Find patient by email
          const patient = await Patient.findOne({
            email: additionalData.patientEmail,
          });
          console.log(patient);
          if (patient) {
            // Create caregiver relationship if patient exists
            user = await Caregiver.create({
              ...userData,
              patient: patient._id,
              deviceId: additionalData.deviceId || 2113,
              relationship: additionalData.relationship || "Caregiver",
              isAlsoFamilyMember: additionalData.isAlsoFamilyMember || true,
            });
          } else {
            user = await Caregiver.create({
              userData,
              deviceId: additionalData.deviceId || 2113,
              relationship: additionalData.relationship || "Caregiver",
              isAlsoFamilyMember: additionalData.isAlsoFamilyMember || true,
            });
          }
          // If patient doesn't exist, just proceed without creating relationship
        }
        break;
      case "family":
        // If family, check if patient email and relationship are provided
        if (additionalData.patientEmail && additionalData.relationship) {
          // Find patient by email
          const patient = await Patient.findOne({
            email: additionalData.patientEmail,
          });
          if (patient) {
            // Create family relationship if patient exists
            user = await Family.create({
              ...userData,
              patient: patient._id,
              relationship: additionalData.relationship,
            });
          } else {
            return res.status(400).json({
              success: false,
              error: "Patient Does not exist or First Make account of Patient",
              message: "Patient Does not exist First Patient Should Login In",
            });
          }
          // If patient doesn't exist, just proceed without creating relationship
        }
        break;
      default:
        // Default case should not happen due to validation
        return res.status(400).json({
          success: false,
          error: "Invalid user type",
        });
    }

    // Generate token
    const token = generateToken(user._id);

    // Send response
    res.status(201).json({
      success: true,
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    logger.error(`Register error: ${error.message}`);
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Check if password matches
    const isMatch = user.password === password;
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Send response
    res.status(200).json({
      success: true,
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    // User is already attached to req by auth middleware
    const user = req.user;

    // Get additional data based on user type
    let userData = { ...user.toObject() };
    delete userData.password;

    // For patient, get devices
    if (user.userType === "patient") {
      // Fetch patient with populated fields
      const patientData = await Patient.findById(user._id)
        .populate("devices")
        .select("-password");

      userData = patientData;
    }
    // For caregiver, get patients
    else if (user.userType === "caregiver") {
      const caregiverData = await Caregiver.find({ user: user._id }).populate(
        "patient"
      );

      userData.caregiverFor = caregiverData;
    }
    // For family, get patient relationships
    else if (user.userType === "family") {
      const familyData = await Family.find({ user: user._id }).populate(
        "patient"
      );

      userData.familyFor = familyData;
    }

    res.status(200).json({
      success: true,
      data: userData,
    });
  } catch (error) {
    logger.error(`Get me error: ${error.message}`);
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;

    // Create update object
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (avatar) updateData.avatar = avatar;

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    logger.error(`Update profile error: ${error.message}`);
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select("+password");

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    logger.error(`Change password error: ${error.message}`);
    next(error);
  }
};
