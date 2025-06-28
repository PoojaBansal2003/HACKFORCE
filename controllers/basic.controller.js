const Caregiver = require("../models/caregiver.model");
const Patient = require("../models/patient.model");
const Family = require("../models/family.model");
const asyncHandler = require("../utils/asyncHandler");

exports.getCaretakerDetails = asyncHandler(async (req, res) => {
  const { patientId } = req.body;

  // Find patient and validate
  const patient = await Patient.findById(patientId);
  if (!patient) {
    return res.status(404).json({
      success: false,
      message: "Patient not found",
    });
  }

  // Find caregiver and populate patient data
  const caregiver = await Caregiver.findOne({ patient: patientId }).populate(
    "patient"
  ); // This will populate all patient data referenced in the patients array

  if (!caregiver) {
    return res.status(404).json({
      success: false,
      message: "Caregiver profile not found",
    });
  }

  res.json({
    success: true,
    message: "Caregiver Details fetched successfully",
    data: {
      caregiver,
      patientDetails: patient, // Optional: include specific patient details if needed
    },
  });
});

exports.getPatientDetails = asyncHandler(async (req, res) => {
  const { patientId } = req.body;
  console.log(patientId);
  // Find and validate patient
  const patient = await Patient.findById(patientId);
  if (!patient) {
    return res.status(404).json({
      success: false,
      message: "Patient not found",
    });
  }

  res.json({
    success: true,
    message: "Patient details fetched successfully",
    data: {
      patient,
    },
  });
});

exports.getAllFamilyMembers = asyncHandler(async (req, res) => {
  const { patientId } = req.body;

  // Find and validate patient
  const patient = await Patient.findById(patientId);
  if (!patient) {
    return res.status(404).json({
      success: false,
      message: "Patient not found",
    });
  }

  // Find all family members associated with this patient (without population)
  const familyMembers = await Family.find({ patient: patientId });

  res.json({
    success: true,
    message: "Family details fetched successfully",
    data: {
      patient,
      familyMembers,
    },
  });
});
