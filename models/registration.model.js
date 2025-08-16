const mongoose = require("mongoose");
const { Schema } = mongoose;

// Registration Schema
const registrationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hackathonId: {
      type: Schema.Types.ObjectId,
      ref: "Hackathon",
      required: true,
    },
    // Additional fields
    status: {
      type: String,
      enum: ["registered", "confirmed", "cancelled", "waitlisted"],
      default: "registered",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    paymentId: {
      type: String,
      trim: true,
    },
    preferences: {
      dietaryRestrictions: String,
      tshirtSize: {
        type: String,
        enum: ["XS", "S", "M", "L", "XL", "XXL"],
      },
      emergencyContact: {
        name: String,
        phone: String,
        relation: String,
      },
    },
  },
  {
    timestamps: true,
    collection: "registrations",
  }
);

// Compound unique index
registrationSchema.index({ userId: 1, hackathonId: 1 }, { unique: true });
registrationSchema.index({ hackathonId: 1 });
registrationSchema.index({ status: 1 });

const Registration = mongoose.model("Registration", registrationSchema);

export default Registration;
