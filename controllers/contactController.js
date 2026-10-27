const Contact = require('../models/Contact');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/contacts:
 *   get:
 *     summary: Get all contacts with pagination, sorting, and filtering
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [game-support, bug-report, fan-art, business, press, general, other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [New, In Progress, Resolved, Closed]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [Low, Medium, High, Urgent]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, name, email, category, status, priority]
 *           default: newest
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Contacts retrieved successfully
 *       401:
 *         description: Unauthorized
 */
const getAllContacts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { category, status, priority, search, sort, isRead } = req.query;
    
    // Build query
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort
    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'name':
        sortOption = { name: 1 };
        break;
      case 'email':
        sortOption = { email: 1 };
        break;
      case 'category':
        sortOption = { category: 1 };
        break;
      case 'status':
        sortOption = { status: 1 };
        break;
      case 'priority':
        sortOption = { priority: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }
    
    // Debug logging
    logger.info('contact', `Query parameters: page=${page}, limit=${limit}, category=${category}, status=${status}, search=${search}, sort=${sort}`);
    logger.info('contact', `Built query:`, JSON.stringify(query));
    
    const contacts = await Contact.find(query)
      .populate('assignedTo', 'username firstName lastName')
      .populate('respondedBy', 'username firstName lastName')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Contact.countDocuments(query);
    
    logger.info('contact', `Retrieved ${contacts.length} contacts for page ${page}, total: ${total}`);
    
    res.status(200).json({
      success: true,
      data: {
        contacts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalContacts: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('contact', 'Failed to get contacts', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contacts',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/contacts/{id}:
 *   get:
 *     summary: Get a single contact by ID
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact retrieved successfully
 *       404:
 *         description: Contact not found
 */
const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('assignedTo', 'username firstName lastName email')
      .populate('respondedBy', 'username firstName lastName email');
    
    if (!contact) {
      logger.warn('contact', `Contact not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    
    // Mark as read if not already
    if (!contact.isRead) {
      await contact.markAsRead();
    }
    
    logger.info('contact', `Contact viewed: ${contact.subject}`);
    
    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error) {
    logger.error('contact', 'Failed to get contact', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contact',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/contacts:
 *   post:
 *     summary: Create a new contact/inquiry
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - category
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *               subject:
 *                 type: string
 *                 maxLength: 200
 *               category:
 *                 type: string
 *                 enum: [game-support, bug-report, fan-art, business, press, general, other]
 *               message:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Contact created successfully
 *       400:
 *         description: Validation error
 */
const createContact = async (req, res) => {
  try {
    const contactData = req.body;
    
    const contact = new Contact(contactData);
    await contact.save();
    
    logger.info('contact', `New contact created: ${contact.subject} from ${contact.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Contact submitted successfully',
      data: contact
    });
  } catch (error) {
    logger.error('contact', 'Failed to create contact', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create contact',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/contacts/{id}:
 *   put:
 *     summary: Update a contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *               subject:
 *                 type: string
 *                 maxLength: 200
 *               category:
 *                 type: string
 *                 enum: [game-support, bug-report, fan-art, business, press, general, other]
 *               message:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *               status:
 *                 type: string
 *                 enum: [New, In Progress, Resolved, Closed]
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High, Urgent]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Contact updated successfully
 *       404:
 *         description: Contact not found
 */
const updateContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      logger.warn('contact', `Contact not found for update: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    
    const updatedContact = await Contact.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('assignedTo', 'username firstName lastName')
     .populate('respondedBy', 'username firstName lastName');
    
    logger.info('contact', `Contact updated: ${updatedContact.subject} by ${req.user.username}`);
    
    res.status(200).json({
      success: true,
      message: 'Contact updated successfully',
      data: updatedContact
    });
  } catch (error) {
    logger.error('contact', 'Failed to update contact', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/contacts/{id}:
 *   delete:
 *     summary: Delete a contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 *       404:
 *         description: Contact not found
 */
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      logger.warn('contact', `Contact not found for deletion: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    
    await Contact.findByIdAndDelete(req.params.id);
    
    logger.info('contact', `Contact deleted: ${contact.subject} by ${req.user.username}`);
    
    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    logger.error('contact', 'Failed to delete contact', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/contacts/{id}/assign:
 *   put:
 *     summary: Assign a contact to a user
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assignedTo
 *             properties:
 *               assignedTo:
 *                 type: string
 *                 description: User ID to assign the contact to
 *     responses:
 *       200:
 *         description: Contact assigned successfully
 *       404:
 *         description: Contact not found
 */
const assignContact = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      logger.warn('contact', `Contact not found for assignment: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    
    contact.assignedTo = assignedTo;
    await contact.save();
    
    await contact.populate('assignedTo', 'username firstName lastName');
    
    logger.info('contact', `Contact assigned: ${contact.subject} to user ${assignedTo} by ${req.user.username}`);
    
    res.status(200).json({
      success: true,
      message: 'Contact assigned successfully',
      data: contact
    });
  } catch (error) {
    logger.error('contact', 'Failed to assign contact', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign contact',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/contacts/{id}/respond:
 *   put:
 *     summary: Respond to a contact
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - response
 *             properties:
 *               response:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Response message
 *     responses:
 *       200:
 *         description: Response added successfully
 *       404:
 *         description: Contact not found
 */
const respondToContact = async (req, res) => {
  try {
    const { response } = req.body;
    
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      logger.warn('contact', `Contact not found for response: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    
    await contact.respond(response, req.user._id);
    
    await contact.populate('respondedBy', 'username firstName lastName');
    
    logger.info('contact', `Response added to contact: ${contact.subject} by ${req.user.username}`);
    
    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      data: contact
    });
  } catch (error) {
    logger.error('contact', 'Failed to respond to contact', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to contact',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/contacts/{id}/mark-read:
 *   put:
 *     summary: Mark a contact as read
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact marked as read
 *       404:
 *         description: Contact not found
 */
const markAsRead = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      logger.warn('contact', `Contact not found for mark as read: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    
    await contact.markAsRead();
    
    logger.info('contact', `Contact marked as read: ${contact.subject} by ${req.user.username}`);
    
    res.status(200).json({
      success: true,
      message: 'Contact marked as read',
      data: contact
    });
  } catch (error) {
    logger.error('contact', 'Failed to mark contact as read', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark contact as read',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  getAllContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  assignContact,
  respondToContact,
  markAsRead
};
