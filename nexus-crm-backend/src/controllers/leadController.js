/**
 * Lead Controller
 * Full CRUD + search, filter, sort, pagination, bulk actions, CSV export
 */

'use strict';

const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const { AppError } = require('../middleware/errorMiddleware');
const { logActivity } = require('../utils/activityLogger');
const { generateCSV } = require('../utils/csvExporter');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

// ─── GET /api/v1/leads ────────────────────────────────────────────────────────
exports.getAllLeads = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      source,
      priority,
      assignedTo,
      search,
      sort = '-createdAt',
      startDate,
      endDate,
    } = req.query;

    // Build filter
    const filter = {};

    if (status) filter.status = status;
    if (source) filter.source = source;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Role-based: sales_reps only see their own leads
    if (req.user.role === 'sales_rep') {
      filter.assignedTo = req.user._id;
    }

    // Full-text search or regex
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { company: searchRegex },
        { message: searchRegex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('assignedTo', 'name email avatar')
        .populate('createdBy', 'name email')
        .lean(),
      Lead.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: leads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/leads/:id ────────────────────────────────────────────────────
exports.getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email')
      .populate('notes.createdBy', 'name email');

    if (!lead) {
      return next(new AppError(`Lead not found with ID: ${req.params.id}`, 404));
    }

    // sales_rep can only view their own leads
    if (
      req.user.role === 'sales_rep' &&
      lead.assignedTo?._id.toString() !== req.user._id.toString()
    ) {
      return next(new AppError('You do not have permission to view this lead.', 403));
    }

    // Attach to req so downstream middleware can check ownership
    req.resource = lead;

    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/leads ───────────────────────────────────────────────────────
exports.createLead = async (req, res, next) => {
  try {
    const leadData = { ...req.body, createdBy: req.user._id };

    // If no assignedTo, default to creator
    if (!leadData.assignedTo) {
      leadData.assignedTo = req.user._id;
    }

    const lead = await Lead.create(leadData);
    await lead.populate('assignedTo', 'name email');
    await lead.populate('createdBy', 'name email');

    await logActivity({
      action: 'lead_created',
      description: `New lead created: ${lead.fullName} from ${lead.company || 'Unknown Co.'}`,
      performedBy: req.user,
      lead,
      metadata: { status: lead.status, source: lead.source },
      req,
    });

    // Email notification to assigned rep if different from creator
    if (
      lead.assignedTo &&
      lead.assignedTo._id.toString() !== req.user._id.toString()
    ) {
      emailService
        .sendLeadAssignmentNotification(lead, lead.assignedTo, req.user)
        .catch((err) => logger.error('Failed to send assignment email:', err.message));
    }

    logger.info(`Lead created: ${lead._id} by ${req.user.email}`);
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/v1/leads/:id ────────────────────────────────────────────────────
exports.updateLead = async (req, res, next) => {
  try {
    const existing = await Lead.findById(req.params.id);
    if (!existing) {
      return next(new AppError('Lead not found.', 404));
    }

    const prevStatus = existing.status;
    const prevAssignedTo = existing.assignedTo?.toString();

    // Merge update
    const updated = await Lead.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email');

    // Log status change separately for better activity trail
    if (prevStatus !== updated.status) {
      await logActivity({
        action: 'lead_status_changed',
        description: `Status changed: ${updated.fullName} — ${prevStatus} → ${updated.status}`,
        performedBy: req.user,
        lead: updated,
        metadata: { from: prevStatus, to: updated.status },
        req,
      });
    } else {
      await logActivity({
        action: 'lead_updated',
        description: `Lead updated: ${updated.fullName}`,
        performedBy: req.user,
        lead: updated,
        req,
      });
    }

    // Notify new assignee
    if (
      updated.assignedTo &&
      updated.assignedTo._id.toString() !== prevAssignedTo &&
      updated.assignedTo._id.toString() !== req.user._id.toString()
    ) {
      emailService
        .sendLeadAssignmentNotification(updated, updated.assignedTo, req.user)
        .catch((err) => logger.error('Failed to send assignment email:', err.message));
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/leads/:id/status ──────────────────────────────────────────
exports.updateLeadStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return next(new AppError('Status is required.', 400));

    const lead = await Lead.findById(req.params.id);
    if (!lead) return next(new AppError('Lead not found.', 404));

    const prevStatus = lead.status;
    lead.status = status;
    await lead.save();

    await logActivity({
      action: 'lead_status_changed',
      description: `Status: ${lead.fullName} — ${prevStatus} → ${status}`,
      performedBy: req.user,
      lead,
      metadata: { from: prevStatus, to: status },
      req,
    });

    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/v1/leads/:id ─────────────────────────────────────────────────
exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return next(new AppError('Lead not found.', 404));

    // Soft delete
    lead.isDeleted = true;
    lead.deletedAt = new Date();
    await lead.save();

    await logActivity({
      action: 'lead_deleted',
      description: `Lead deleted: ${lead.fullName} (${lead.company || 'No company'})`,
      performedBy: req.user,
      lead,
      req,
    });

    res.json({ success: true, message: 'Lead deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/leads/bulk ──────────────────────────────────────────────────
exports.bulkAction = async (req, res, next) => {
  try {
    const { ids, action, value } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('No lead IDs provided.', 400));
    }
    if (!action) return next(new AppError('Action is required.', 400));

    let result;
    let activityDesc;

    if (action === 'update_status') {
      if (!value) return next(new AppError('Status value required.', 400));
      result = await Lead.updateMany({ _id: { $in: ids } }, { status: value });
      activityDesc = `Bulk status update: ${ids.length} leads → ${value}`;

      await logActivity({
        action: 'bulk_status_update',
        description: activityDesc,
        performedBy: req.user,
        metadata: { ids, newStatus: value, count: ids.length },
        req,
      });
    } else if (action === 'delete') {
      result = await Lead.updateMany(
        { _id: { $in: ids } },
        { isDeleted: true, deletedAt: new Date() }
      );
      activityDesc = `Bulk delete: ${ids.length} leads removed`;

      await logActivity({
        action: 'bulk_delete',
        description: activityDesc,
        performedBy: req.user,
        metadata: { ids, count: ids.length },
        req,
      });
    } else if (action === 'assign') {
      if (!value) return next(new AppError('User ID required for assign.', 400));
      result = await Lead.updateMany({ _id: { $in: ids } }, { assignedTo: value });
      activityDesc = `Bulk assign: ${ids.length} leads reassigned`;

      await logActivity({
        action: 'lead_assigned',
        description: activityDesc,
        performedBy: req.user,
        metadata: { ids, assignedTo: value, count: ids.length },
        req,
      });
    } else {
      return next(new AppError(`Unknown bulk action: ${action}`, 400));
    }

    res.json({
      success: true,
      message: activityDesc,
      affected: result.modifiedCount || result.matchedCount,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/leads/export/csv ─────────────────────────────────────────────
exports.exportCSV = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.source) filter.source = req.query.source;
    if (req.user.role === 'sales_rep') filter.assignedTo = req.user._id;

    const leads = await Lead.find(filter)
      .sort('-createdAt')
      .populate('assignedTo', 'name')
      .populate('createdBy', 'name')
      .lean();

    const csv = generateCSV(leads);

    await logActivity({
      action: 'csv_export',
      description: `CSV exported: ${leads.length} leads`,
      performedBy: req.user,
      metadata: { count: leads.length, filter },
      req,
    });

    const filename = `nexus-crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/leads (public contact form) ─────────────────────────────────
exports.publicSubmit = async (req, res, next) => {
  try {
    // Find a system/admin user to assign the lead to
    const User = require('../models/User');
    const admin = await User.findOne({ role: 'admin', isActive: true });
    if (!admin) {
      return next(new AppError('No admin user configured. Please contact support.', 500));
    }

    const lead = await Lead.create({
      ...req.body,
      status: 'New',
      source: req.body.source || 'Website',
      createdBy: admin._id,
      assignedTo: admin._id,
    });

    await logActivity({
      action: 'lead_created',
      description: `Public form submission: ${lead.fullName}`,
      performedBy: admin,
      lead,
      metadata: { via: 'contact_form' },
      req,
    });

    // Notify admin of new submission
    emailService
      .sendNewLeadNotification(lead, admin)
      .catch((err) => logger.error('Failed to send new lead email:', err.message));

    res.status(201).json({
      success: true,
      message: 'Thank you! Our team will be in touch within 24 hours.',
    });
  } catch (err) {
    next(err);
  }
};
