/**
 * Lead Model
 * Core CRM entity — tracks prospect through the sales pipeline
 */

'use strict';

const mongoose = require('mongoose');

const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Converted', 'Closed'];
const LEAD_SOURCES = ['Website', 'Referral', 'LinkedIn', 'Email Campaign', 'Cold Call', 'Trade Show', 'Other'];

const NoteSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true,
      maxlength: [2000, 'Note cannot exceed 2000 characters'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByName: {
      type: String, // Denormalized for quick display without populate
    },
  },
  { timestamps: true, _id: true }
);

const AttachmentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimetype: String,
  size: Number,
  path: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
});

const LeadSchema = new mongoose.Schema(
  {
    // ── Contact Info ────────────────────────────────────────────────────────
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [30, 'Phone number too long'],
      default: null,
    },
    company: {
      type: String,
      trim: true,
      maxlength: [150, 'Company name too long'],
      default: null,
    },

    // ── Pipeline ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: LEAD_STATUSES,
        message: `Status must be one of: ${LEAD_STATUSES.join(', ')}`,
      },
      default: 'New',
    },
    source: {
      type: String,
      enum: {
        values: LEAD_SOURCES,
        message: `Source must be one of: ${LEAD_SOURCES.join(', ')}`,
      },
      default: 'Website',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },

    // ── Assignment ────────────────────────────────────────────────────────────
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // ── Content ───────────────────────────────────────────────────────────────
    message: {
      type: String,
      trim: true,
      maxlength: [3000, 'Message cannot exceed 3000 characters'],
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },

    // ── Embedded Notes (fast access) ─────────────────────────────────────────
    notes: {
      type: [NoteSchema],
      default: [],
    },

    // ── File Attachments ──────────────────────────────────────────────────────
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },

    // ── Follow-up ─────────────────────────────────────────────────────────────
    nextFollowUpAt: {
      type: Date,
      default: null,
    },

    // ── Conversion Tracking ──────────────────────────────────────────────────
    convertedAt: {
      type: Date,
      default: null,
    },
    dealValue: {
      type: Number,
      min: [0, 'Deal value cannot be negative'],
      default: null,
    },

    // ── Soft Delete ───────────────────────────────────────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.__v;
        delete ret.isDeleted;
        delete ret.deletedAt;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
LeadSchema.index({ email: 1 });
LeadSchema.index({ status: 1 });
LeadSchema.index({ assignedTo: 1 });
LeadSchema.index({ createdBy: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ isDeleted: 1 });
// Full-text search
LeadSchema.index({ fullName: 'text', email: 'text', company: 'text', message: 'text' });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
LeadSchema.virtual('noteCount').get(function () {
  return this.notes ? this.notes.length : 0;
});

// ─── Middleware ───────────────────────────────────────────────────────────────

// Auto-set convertedAt when status changes to Converted
LeadSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'Converted' && !this.convertedAt) {
      this.convertedAt = new Date();
    } else if (this.status !== 'Converted') {
      this.convertedAt = null;
    }
  }
  next();
});

// Default query filter: exclude soft-deleted
LeadSchema.pre(/^find/, function (next) {
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

const Lead = mongoose.model('Lead', LeadSchema);

module.exports = Lead;
module.exports.LEAD_STATUSES = LEAD_STATUSES;
module.exports.LEAD_SOURCES = LEAD_SOURCES;
