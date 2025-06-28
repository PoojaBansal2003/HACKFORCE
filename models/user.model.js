const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Invalid email"],
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    userType: {
      type: String,
      enum: [
        "Patient",
        "Caregiver",
        "Family",
        "patient",
        "caregiver",
        "family",
      ],
      required: true,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, "Invalid phone number"],
    },
    avatar: {
      type: String,
      default: "default-avatar.png",
    },
  },
  {
    timestamps: true,
    discriminatorKey: "kind",
  }
);

module.exports = mongoose.model("User", userSchema);
