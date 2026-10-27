const express = require('express');
const router = express.Router();
const {
  getAllContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  assignContact,
  respondToContact,
  markAsRead
} = require('../controllers/contactController');
const { auth, authorize } = require('../middleware/auth');
const { 
  validate, 
  validateContact, 
  validateContactUpdate, 
  validateContactAssignment, 
  validateContactResponse 
} = require('../middleware/validation');

/**
 * @swagger
 * tags:
 *   name: Contacts
 *   description: Contact/Inquiry management and customer support
 */

// @route   GET /api/contacts
// @desc    Get all contacts with pagination, sorting, and filtering
// @access  Private (Admin/Moderator only)
router.get('/', auth, authorize('admin', 'moderator'), getAllContacts);

// @route   GET /api/contacts/:id
// @desc    Get a single contact by ID
// @access  Private (Admin/Moderator only)
router.get('/:id', auth, authorize('admin', 'moderator'), getContactById);

// @route   POST /api/contacts
// @desc    Create a new contact/inquiry (Public endpoint)
// @access  Public
router.post('/', validateContact, validate, createContact);

// @route   PUT /api/contacts/:id
// @desc    Update a contact
// @access  Private (Admin/Moderator only)
router.put('/:id', auth, authorize('admin', 'moderator'), validateContactUpdate, validate, updateContact);

// @route   DELETE /api/contacts/:id
// @desc    Delete a contact
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), deleteContact);

// @route   PUT /api/contacts/:id/assign
// @desc    Assign a contact to a user
// @access  Private (Admin/Moderator only)
router.put('/:id/assign', auth, authorize('admin', 'moderator'), validateContactAssignment, validate, assignContact);

// @route   PUT /api/contacts/:id/respond
// @desc    Respond to a contact
// @access  Private (Admin/Moderator only)
router.put('/:id/respond', auth, authorize('admin', 'moderator'), validateContactResponse, validate, respondToContact);

// @route   PUT /api/contacts/:id/mark-read
// @desc    Mark a contact as read
// @access  Private (Admin/Moderator only)
router.put('/:id/mark-read', auth, authorize('admin', 'moderator'), markAsRead);

module.exports = router;
