/**
 * Activity Controller
 * Audit trail / activity log endpoints
 */

'use strict';

const Activity = require('../models/Activity');
const { AppError } = require('../middleware/errorMiddleware');

// ─── GET /api/v1/activities ───────────────────────────────────────────────────
exports.getActivities = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, action } = req.query;
    const filter = {};

    if (action) filter.action = action;

    // Sales reps only see their own activity
    if (req.user.role === 'sales_rep') {
      filter.performedBy = req.user._id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activities, total] = await Promise.all([
      Activity.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .populate('performedBy', 'name email avatar')
        .populate('lead', 'fullName company')
        .lean(),
      Activity.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/activities/lead/:leadId ──────────────────────────────────────
exports.getLeadActivities = async (req, res, next) => {
  try {
    const activities = await Activity.find({ lead: req.params.leadId })
      .sort('-createdAt')
      .limit(50)
      .populate('performedBy', 'name email avatar')
      .lean();

    res.json({ success: true, count: activities.length, data: activities });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/activities/me ────────────────────────────────────────────────
exports.getMyActivities = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activities, total] = await Promise.all([
      Activity.find({ performedBy: req.user._id })
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .populate('lead', 'fullName company')
        .lean(),
      Activity.countDocuments({ performedBy: req.user._id }),
    ]);

    res.json({
      success: true,
      data: activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/v1/activities/clear (admin only) ─────────────────────────────
exports.clearOldActivities = async (req, res, next) => {
  try {
    const { olderThanDays = 90 } = req.query;
    const cutoff = new Date(Date.now() - parseInt(olderThanDays) * 24 * 60 * 60 * 1000);

    const result = await Activity.deleteMany({ createdAt: { $lt: cutoff } });

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} activity records older than ${olderThanDays} days.`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    next(err);
  }
};
