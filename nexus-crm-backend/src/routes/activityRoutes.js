/**
 * Activity Routes — /api/v1/activities
 */

'use strict';

const express = require('express');
const router = express.Router();

const activityController = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Get all activities — paginated
router.get('/', activityController.getActivities);

// Get activities for a specific lead
router.get('/lead/:leadId', activityController.getLeadActivities);

// Get activities by current user
router.get('/me', activityController.getMyActivities);

// Admin: clear old activity logs
router.delete('/clear', authorize('admin'), activityController.clearOldActivities);

module.exports = router;
