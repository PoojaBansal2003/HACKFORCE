import Hackathon from "../models/Hackathon.js";
import { validationResult } from "express-validator";

// Create a new hackathon
export const createHackathon = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const hackathon = new Hackathon(req.body);
    const savedHackathon = await hackathon.save();

    res.status(201).json({
      success: true,
      message: "Hackathon created successfully",
      data: savedHackathon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating hackathon",
      error: error.message,
    });
  }
};

// Get all hackathons with filtering, sorting, and pagination
export const getAllHackathons = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      mode,
      isActive,
      tags,
      sortBy = "startDate",
      sortOrder = "asc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) filter.status = status;
    if (mode) filter.mode = mode;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (tags) {
      const tagArray = tags.split(",").map((tag) => tag.trim());
      filter.tags = { $in: tagArray };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const hackathons = await Hackathon.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Hackathon.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: hackathons,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching hackathons",
      error: error.message,
    });
  }
};

// Get hackathon by ID
export const getHackathonById = async (req, res) => {
  try {
    const { id } = req.params;
    const hackathon = await Hackathon.findById(id);

    if (!hackathon) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    res.status(200).json({
      success: true,
      data: hackathon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching hackathon",
      error: error.message,
    });
  }
};

// Update hackathon by ID
export const updateHackathon = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const updatedHackathon = await Hackathon.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedHackathon) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Hackathon updated successfully",
      data: updatedHackathon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating hackathon",
      error: error.message,
    });
  }
};

// Delete hackathon by ID
export const deleteHackathon = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedHackathon = await Hackathon.findByIdAndDelete(id);

    if (!deletedHackathon) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Hackathon deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting hackathon",
      error: error.message,
    });
  }
};

// Get active hackathons
export const getActiveHackathons = async (req, res) => {
  try {
    const hackathons = await Hackathon.find({
      isActive: true,
      status: { $ne: "cancelled" },
    }).sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      data: hackathons,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching active hackathons",
      error: error.message,
    });
  }
};

// Get upcoming hackathons
export const getUpcomingHackathons = async (req, res) => {
  try {
    const currentDate = new Date();
    const hackathons = await Hackathon.find({
      isActive: true,
      startDate: { $gt: currentDate },
      status: { $in: ["upcoming", "registration_open"] },
    }).sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      data: hackathons,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching upcoming hackathons",
      error: error.message,
    });
  }
};

// Get ongoing hackathons
export const getOngoingHackathons = async (req, res) => {
  try {
    const currentDate = new Date();
    const hackathons = await Hackathon.find({
      isActive: true,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
      status: "ongoing",
    }).sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      data: hackathons,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching ongoing hackathons",
      error: error.message,
    });
  }
};

// Get hackathons by tags
export const getHackathonsByTags = async (req, res) => {
  try {
    const { tags } = req.query;

    if (!tags) {
      return res.status(400).json({
        success: false,
        message: "Tags parameter is required",
      });
    }

    const tagArray = tags.split(",").map((tag) => tag.trim());
    const hackathons = await Hackathon.find({
      tags: { $in: tagArray },
      isActive: true,
    }).sort({ startDate: 1 });

    res.status(200).json({
      success: true,
      data: hackathons,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching hackathons by tags",
      error: error.message,
    });
  }
};

// Update hackathon status
export const updateHackathonStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "upcoming",
      "registration_open",
      "registration_closed",
      "ongoing",
      "completed",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const updatedHackathon = await Hackathon.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedHackathon) {
      return res.status(404).json({
        success: false,
        message: "Hackathon not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Hackathon status updated successfully",
      data: updatedHackathon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating hackathon status",
      error: error.message,
    });
  }
};

// Search hackathons
export const searchHackathons = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const searchRegex = new RegExp(query, "i");
    const filter = {
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } },
        { venue: searchRegex },
      ],
      isActive: true,
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const hackathons = await Hackathon.find(filter)
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Hackathon.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: hackathons,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error searching hackathons",
      error: error.message,
    });
  }
};

// Get hackathon statistics
export const getHackathonStats = async (req, res) => {
  try {
    const stats = await Hackathon.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          upcoming: {
            $sum: { $cond: [{ $eq: ["$status", "upcoming"] }, 1, 0] },
          },
          ongoing: {
            $sum: { $cond: [{ $eq: ["$status", "ongoing"] }, 1, 0] },
          },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      total: 0,
      active: 0,
      upcoming: 0,
      ongoing: 0,
      completed: 0,
      cancelled: 0,
    };

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching hackathon statistics",
      error: error.message,
    });
  }
};
