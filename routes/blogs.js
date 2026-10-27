const express = require('express');
const router = express.Router();
const {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  likeBlog,
  addComment
} = require('../controllers/blogController');
const { auth } = require('../middleware/auth');
const { validate, validateBlog, validateComment } = require('../middleware/validation');


// @route   GET /api/blogs
// @desc    Get all published blogs
// @access  Public
router.get('/', getAllBlogs);

// @route   GET /api/blogs/:id
// @desc    Get a single blog by ID
// @access  Public
router.get('/:id', getBlogById);

// @route   POST /api/blogs
// @desc    Create a new blog post
// @access  Private
router.post('/', auth, validateBlog, validate, createBlog);

// @route   PUT /api/blogs/:id
// @desc    Update a blog post
// @access  Private
router.put('/:id', auth, updateBlog);

// @route   DELETE /api/blogs/:id
// @desc    Delete a blog post
// @access  Private
router.delete('/:id', auth, deleteBlog);

// @route   POST /api/blogs/:id/like
// @desc    Like or unlike a blog post
// @access  Private
router.post('/:id/like', auth, likeBlog);

// @route   POST /api/blogs/:id/comments
// @desc    Add a comment to a blog post
// @access  Private
router.post('/:id/comments', auth, validateComment, validate, addComment);

module.exports = router;
