const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/user.model");

exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-password").populate({
    path: req.user.userType,
    select: "-user -__v",
  });

  res.json({ success: true, data: user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ["name", "phone", "avatar"];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) throw new Error("Invalid updates!");

  const user = await User.findByIdAndUpdate(req.user.id, req.body, {
    new: true,
    runValidators: true,
  }).select("-password");

  res.json({ success: true, data: user });
});

exports.linkPatientToFamily = asyncHandler(async (req, res) => {
  if (req.user.userType !== "family")
    throw new Error("Only family members can link patients");

  const patient = await User.findOne({
    _id: req.body.patientId,
    userType: "patient",
  });
  if (!patient) throw new Error("Patient not found");

  // Implementation depends on your relationship structure
  // This is a simplified version
  await User.updateOne(
    { _id: req.user.id },
    { $addToSet: { patients: patient._id } }
  );

  res.json({ success: true, message: "Patient linked successfully" });
});
