/**
 * Analytics Routes — /api/v1/analytics
 */

'use strict';

const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Dashboard summary — all roles
router.get('/dashboard', analyticsController.getDashboard);

// Funnel — managers and above
router.get('/funnel', authorize('admin', 'manager'), analyticsController.getFunnel);

// Rep performance — managers and above
router.get('/rep-performance', authorize('admin', 'manager'), analyticsController.getRepPerformance);

module.exports = router;
