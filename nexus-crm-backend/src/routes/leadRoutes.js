/**
 * Lead Routes — /api/v1/leads
 */

'use strict';

const express = require('express');
const router = express.Router();

const leadController = require('../controllers/leadController');
const { protect, authorize, optionalAuth } = require('../middleware/authMiddleware');
const {
  createLeadValidator,
  updateLeadValidator,
  leadIdValidator,
  leadQueryValidator,
} = require('../middleware/validationMiddleware');

// ── Public contact form (no auth required) ────────────────────────────────────
router.post('/public', optionalAuth, createLeadValidator, leadController.publicSubmit);

// ── All routes below require authentication ───────────────────────────────────
router.use(protect);

// GET  /api/v1/leads/export/csv — must come before /:id to avoid param conflict
router.get('/export/csv', authorize('admin', 'manager'), leadController.exportCSV);

// POST /api/v1/leads/bulk
router.post('/bulk', authorize('admin', 'manager'), leadController.bulkAction);

// Standard CRUD
router
  .route('/')
  .get(leadQueryValidator, leadController.getAllLeads)
  .post(createLeadValidator, leadController.createLead);

router
  .route('/:id')
  .get(leadIdValidator, leadController.getLeadById)
  .put(updateLeadValidator, leadController.updateLead)
  .delete(leadIdValidator, authorize('admin', 'manager'), leadController.deleteLead);

// Status-only quick update
router.patch('/:id/status', leadIdValidator, leadController.updateLeadStatus);

module.exports = router;
