/**
 * Auth Middleware
 * JWT verification + RBAC (Role-Based Access Control)
 */

'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./errorMiddleware');

/**
 * protect — verifies JWT from Authorization header or cookie
 * Attaches decoded user to req.user
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Check Authorization header
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // 2. Fallback to httpOnly cookie
    else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new AppError('Authentication required. Please log in.', 401));
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check user still exists and is active
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new AppError('User no longer exists.', 401));
    }
    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated. Contact an admin.', 403));
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    next(err);
  }
};

/**
 * authorize — RBAC middleware factory
 * Usage: authorize('admin', 'manager')
 *
 * Role hierarchy:
 *   admin > manager > sales_rep > viewer
 */
const ROLE_HIERARCHY = { admin: 4, manager: 3, sales_rep: 2, viewer: 1 };

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }
  if (!roles.includes(req.user.role)) {
    return next(
      new AppError(
        `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}.`,
        403
      )
    );
  }
  next();
};

/**
 * authorizeOwnerOrRole — allows access if user owns the resource OR has the required role
 * Usage: authorizeOwnerOrRole('admin', 'manager')
 * The resource owner check compares req.resource.createdBy with req.user._id
 */
const authorizeOwnerOrRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError('Authentication required.', 401));
  const isOwner = req.resource?.createdBy?.toString() === req.user._id.toString();
  const hasRole = roles.includes(req.user.role);
  if (!isOwner && !hasRole) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  next();
};

/**
 * optionalAuth — attaches user if valid token present, but doesn't block
 * Used for public contact form that can optionally track who submitted
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : req.cookies?.accessToken;

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user?.isActive) req.user = user;
  } catch {
    // Silent fail — optional auth
  }
  next();
};

module.exports = { protect, authorize, authorizeOwnerOrRole, optionalAuth };
