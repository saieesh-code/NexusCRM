/**
 * Activity Logger Utility
 * Centralized helper to create activity log entries
 */

'use strict';

const Activity = require('../models/Activity');
const logger = require('./logger');

/**
 * @param {Object} opts
 * @param {string}  opts.action        - Activity action enum value
 * @param {string}  opts.description   - Human-readable description
 * @param {Object}  opts.performedBy   - User document (or plain object with _id, name)
 * @param {Object}  [opts.lead]        - Lead document (optional)
 * @param {Object}  [opts.metadata]    - Extra context
 * @param {Object}  [opts.req]         - Express request (for ip, userAgent)
 */
const logActivity = async ({ action, description, performedBy, lead, metadata = {}, req }) => {
  try {
    await Activity.create({
      action,
      description,
      performedBy: performedBy._id || performedBy,
      performedByName: performedBy.name || 'System',
      lead: lead?._id || lead || null,
      leadName: lead?.fullName || null,
      metadata,
      ip: req?.ip || null,
      userAgent: req?.get?.('user-agent') || null,
    });
  } catch (err) {
    // Never let activity logging crash the main request
    logger.error('Failed to log activity:', err.message);
  }
};

module.exports = { logActivity };
