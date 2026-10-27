const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logger } = require('../utils/logger');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      logger.warn('auth', 'No token provided');
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      logger.warn('auth', `User not found for token: ${decoded.id}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. User not found.' 
      });
    }

    if (!user.isActive) {
      logger.warn('auth', `Inactive user attempted access: ${user._id}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated.' 
      });
    }

    req.user = user;
    logger.info('auth', `User authenticated: ${user.username}`);
    next();
  } catch (error) {
    logger.error('auth', 'Token verification failed', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('auth', 'Authorization attempted without authentication');
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. Please authenticate first.' 
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('auth', `User ${req.user.username} attempted unauthorized access. Role: ${req.user.role}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    logger.info('auth', `User ${req.user.username} authorized with role: ${req.user.role}`);
    next();
  };
};

module.exports = { auth, authorize };
