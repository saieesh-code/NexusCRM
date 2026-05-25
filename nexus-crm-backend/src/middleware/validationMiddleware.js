/**
 * Validation Middleware
 * All request body validation rules using express-validator
 */

'use strict';

const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('./errorMiddleware');
const { LEAD_STATUSES, LEAD_SOURCES } = require('../models/Lead');

/**
 * Runs express-validator results and formats errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => `${e.path}: ${e.msg}`);
    return next(new AppError('Validation failed', 422, messages));
  }
  next();
};

// ─── Auth Validators ──────────────────────────────────────────────────────────

const registerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and a number'),
  body('role')
    .optional()
    .isIn(['admin', 'manager', 'sales_rep', 'viewer']).withMessage('Invalid role'),
  validate,
];

const loginValidator = [
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and a number'),
  validate,
];

// ─── Lead Validators ──────────────────────────────────────────────────────────

const createLeadValidator = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail().withMessage('Valid email required'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 30 }).withMessage('Phone too long'),
  body('company')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 150 }).withMessage('Company name too long'),
  body('status')
    .optional()
    .isIn(LEAD_STATUSES).withMessage(`Status must be one of: ${LEAD_STATUSES.join(', ')}`),
  body('source')
    .optional()
    .isIn(LEAD_SOURCES).withMessage(`Source must be one of: ${LEAD_SOURCES.join(', ')}`),
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High']).withMessage('Priority must be Low, Medium, or High'),
  body('message')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 3000 }).withMessage('Message too long (max 3000 chars)'),
  body('assignedTo')
    .optional({ checkFalsy: true })
    .isMongoId().withMessage('Invalid assignedTo user ID'),
  body('dealValue')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Deal value must be a positive number'),
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array'),
  validate,
];

const updateLeadValidator = [
  param('id').isMongoId().withMessage('Invalid lead ID'),
  body('fullName').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').optional().trim().normalizeEmail().isEmail().withMessage('Valid email required'),
  body('status').optional().isIn(LEAD_STATUSES).withMessage(`Invalid status`),
  body('source').optional().isIn(LEAD_SOURCES).withMessage('Invalid source'),
  body('priority').optional().isIn(['Low', 'Medium', 'High']).withMessage('Invalid priority'),
  body('assignedTo').optional({ checkFalsy: true }).isMongoId().withMessage('Invalid user ID'),
  body('dealValue').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Invalid deal value'),
  validate,
];

const leadIdValidator = [
  param('id').isMongoId().withMessage('Invalid lead ID'),
  validate,
];

const noteValidator = [
  param('id').isMongoId().withMessage('Invalid lead ID'),
  body('content')
    .trim()
    .notEmpty().withMessage('Note content is required')
    .isLength({ max: 2000 }).withMessage('Note cannot exceed 2000 characters'),
  validate,
];

// ─── Query Validators ─────────────────────────────────────────────────────────

const leadQueryValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1–100'),
  query('status').optional().isIn([...LEAD_STATUSES, '']).withMessage('Invalid status filter'),
  query('source').optional().isIn([...LEAD_SOURCES, '']).withMessage('Invalid source filter'),
  query('priority').optional().isIn(['Low', 'Medium', 'High', '']),
  query('sort').optional().isIn(['createdAt', '-createdAt', 'fullName', '-fullName', 'updatedAt', '-updatedAt']),
  validate,
];

module.exports = {
  registerValidator,
  loginValidator,
  changePasswordValidator,
  createLeadValidator,
  updateLeadValidator,
  leadIdValidator,
  noteValidator,
  leadQueryValidator,
};
