/**
 * Auth Routes — /api/v1/auth
 */

'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  registerValidator,
  loginValidator,
  changePasswordValidator,
} = require('../middleware/validationMiddleware');

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message: { success: false, message: 'Too many auth attempts, please try again in 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Public
router.post('/register', authLimiter, registerValidator, authController.register);
router.post('/login',    authLimiter, loginValidator,    authController.login);
router.post('/logout',   authController.logout);
router.post('/refresh',  authController.refreshToken);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authLimiter, authController.resetPassword);

// Protected
router.use(protect); // All routes below require auth

router.get('/profile',    authController.getProfile);
router.put('/profile',    authController.updateProfile);
router.put('/change-password', changePasswordValidator, authController.changePassword);

// Admin only
router.get('/users', authorize('admin'), authController.getAllUsers);

module.exports = router;
