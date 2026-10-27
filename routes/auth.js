const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword } = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { validate, validateUser, validateLogin, validateChangePassword } = require('../middleware/validation');


// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validateUser, validate, register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, validate, login);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, getMe);

// @route   PUT /api/auth/update-profile
// @desc    Update user profile
// @access  Private
router.put('/update-profile', auth, updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', auth, validateChangePassword, validate, changePassword);

module.exports = router;
