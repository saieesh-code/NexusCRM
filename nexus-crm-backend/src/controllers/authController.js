/**
 * Auth Controller
 * Handles registration, login, profile management, and token refresh
 */

'use strict';

const User = require('../models/User');
const Activity = require('../models/Activity');
const { AppError } = require('../middleware/errorMiddleware');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Sends access + refresh tokens as JSON and httpOnly cookies
 */
const sendTokenResponse = (res, user, statusCode = 200) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res.cookie('accessToken', accessToken, {
    ...cookieOpts,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  });
  res.cookie('refreshToken', refreshToken, {
    ...cookieOpts,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30d
  });

  const { password, ...userData } = user.toObject();

  res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    user: userData,
  });
};

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Only admins can create non-sales_rep accounts
    const assignedRole =
      req.user?.role === 'admin' ? (role || 'sales_rep') : 'sales_rep';

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(new AppError('An account with this email already exists.', 409));
    }

    const user = await User.create({ name, email, password, role: assignedRole });

    await Activity.create({
      action: 'user_registered',
      description: `New user registered: ${user.name} (${user.role})`,
      performedBy: user._id,
      performedByName: user.name,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`New user registered: ${user.email} [${user.role}]`);
    sendTokenResponse(res, user, 201);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password.', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account is deactivated. Contact an administrator.', 403));
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await Activity.create({
      action: 'user_login',
      description: `User logged in: ${user.name}`,
      performedBy: user._id,
      performedByName: user.name,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    logger.info(`User logged in: ${user.email}`);
    sendTokenResponse(res, user);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/auth/profile ─────────────────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/v1/auth/profile ─────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, avatar },
      { new: true, runValidators: true }
    );

    await Activity.create({
      action: 'user_updated',
      description: `Profile updated: ${user.name}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
    });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/v1/auth/change-password ────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return next(new AppError('Current password is incorrect.', 401));
    }

    user.password = newPassword;
    await user.save();

    logger.info(`Password changed for: ${user.email}`);
    sendTokenResponse(res, user);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) return next(new AppError('Refresh token required.', 401));

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return next(new AppError('Invalid refresh token.', 401));
    }

    sendTokenResponse(res, user);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Session expired. Please log in again.', 401));
    }
    next(err);
  }
};

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
exports.logout = (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully.' });
};

// ─── POST /api/v1/auth/forgot-password ───────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email?.toLowerCase() });

    // Always respond 200 to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If that email exists, a reset link has been sent.',
      });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    try {
      await emailService.sendPasswordReset(user.email, user.name, resetURL);
      logger.info(`Password reset email sent to: ${user.email}`);
    } catch (emailErr) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return next(new AppError('Failed to send reset email. Try again later.', 500));
    }

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/auth/reset-password/:token ─────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return next(new AppError('Password reset link is invalid or expired.', 400));
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.info(`Password reset completed for: ${user.email}`);
    sendTokenResponse(res, user);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/auth/users (admin only) ─────────────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    next(err);
  }
};
