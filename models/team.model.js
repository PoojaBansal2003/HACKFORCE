const mongoose = require("mongoose");
const { Schema } = mongoose;

// Team Schema
const teamSchema = new Schema(
  {
    hackathonId: {
      type: Schema.Types.ObjectId,
      ref: "Hackathon",
      required: true,
    },
    problemStatement: {
      type: String,
      required: true,
      trim: true,
    },
    // Additional fields
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxLength: 500,
    },
    leaderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isRecruiting: {
      type: Boolean,
      default: true,
    },
    requiredSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    projectRepo: {
      type: String,
      trim: true,
    },
    projectDemo: {
      type: String,
      trim: true,
    },
    projectPresentation: {
      type: String,
      trim: true,
    },
    submissionStatus: {
      type: String,
      enum: ["not_submitted", "draft", "submitted", "late_submission"],
      default: "not_submitted",
    },
    submittedAt: {
      type: Date,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
    },
    rank: {
      type: Number,
      min: 1,
    },
    feedback: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "teams",
  }
);
// Indexes
teamSchema.index({ hackathonId: 1 });
teamSchema.index({ leaderId: 1 });
teamSchema.index({ isRecruiting: 1 });
teamSchema.index({ submissionStatus: 1 });

const Team = mongoose.model("Team", teamSchema);

export default Team;
