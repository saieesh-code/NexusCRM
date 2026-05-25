/**
 * Activity Model
 * Audit trail for all CRM actions
 */

'use strict';

const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'lead_created', 'lead_updated', 'lead_deleted', 'lead_status_changed',
        'lead_assigned', 'note_added', 'note_deleted',
        'attachment_added', 'attachment_deleted',
        'user_login', 'user_registered', 'user_updated',
        'bulk_status_update', 'bulk_delete', 'csv_export',
      ],
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    performedByName: String, // Denormalized
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
    },
    leadName: String, // Denormalized snapshot
    metadata: {
      type: mongoose.Schema.Types.Mixed, // Extra context (old status, new status, etc.)
      default: {},
    },
    ip: String,
    userAgent: String,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) { delete ret.__v; return ret; },
    },
  }
);

ActivitySchema.index({ performedBy: 1 });
ActivitySchema.index({ lead: 1 });
ActivitySchema.index({ action: 1 });
ActivitySchema.index({ createdAt: -1 });

// Auto-delete activities older than 1 year
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const Activity = mongoose.model('Activity', ActivitySchema);
module.exports = Activity;
