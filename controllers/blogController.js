const Blog = require('../models/Blog');
const { logger } = require('../utils/logger');

/**
 * @swagger
 * /api/blogs:
 *   get:
 *     summary: Get all published blogs
 *     tags: [Blogs]
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, popular]
 *           default: newest
 *     responses:
 *       200:
 *         description: Blogs retrieved successfully
 */
const getAllBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { category, search, sort } = req.query;
    
    // Build query
    let query = { isPublished: true };
    
    if (category) {
      query.category = new RegExp(category, 'i');
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort
    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'popular') {
      sortOption = { views: -1, likes: -1 };
    }
    
    // Debug logging
    logger.info('blog', `Query parameters: page=${page}, limit=${limit}, category=${category}, search=${search}, sort=${sort}`);
    logger.info('blog', `Built query:`, JSON.stringify(query));
    
    const blogs = await Blog.find(query)
      .populate('author', 'username firstName lastName avatar')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Blog.countDocuments(query);
    
    logger.info('blog', `Retrieved ${blogs.length} blogs for page ${page}, total: ${total}`);
    
    res.status(200).json({
      success: true,
      data: {
        blogs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalBlogs: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('blog', 'Failed to get blogs', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve blogs',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/blogs/{id}:
 *   get:
 *     summary: Get a single blog by ID
 *     tags: [Blogs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Blog retrieved successfully
 *       404:
 *         description: Blog not found
 */
const getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate('author', 'username firstName lastName avatar bio')
      .populate('comments.author', 'username firstName lastName avatar');
    
    if (!blog) {
      logger.warn('blog', `Blog not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    // Increment view count
    blog.views += 1;
    await blog.save();
    
    logger.info('blog', `Blog viewed: ${blog.title}`);
    
    res.status(200).json({
      success: true,
      data: blog
    });
  } catch (error) {
    logger.error('blog', 'Failed to get blog', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve blog',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/blogs:
 *   post:
 *     summary: Create a new blog post
 *     tags: [Blogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - content
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               content:
 *                 type: string
 *               category:
 *                 type: string
 *                 maxLength: 50
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               featuredImage:
 *                 type: string
 *               isPublished:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Blog created successfully
 *       401:
 *         description: Unauthorized
 */
const createBlog = async (req, res) => {
  try {
    const blogData = {
      ...req.body,
      author: req.user._id
    };
    
    const blog = new Blog(blogData);
    await blog.save();
    
    await blog.populate('author', 'username firstName lastName avatar');
    
    logger.info('blog', `New blog created: ${blog.title} by ${req.user.username}`);
    
    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      data: blog
    });
  } catch (error) {
    logger.error('blog', 'Failed to create blog', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create blog',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/blogs/{id}:
 *   put:
 *     summary: Update a blog post
 *     tags: [Blogs]
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
 *         description: Blog updated successfully
 *       403:
 *         description: Not authorized to update this blog
 *       404:
 *         description: Blog not found
 */
const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      logger.warn('blog', `Blog not found for update: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    // Check if user is the author or admin
    if (blog.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      logger.warn('blog', `Unauthorized update attempt by ${req.user.username} for blog ${req.params.id}`);
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this blog'
      });
    }
    
    const updatedBlog = await Blog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('author', 'username firstName lastName avatar');
    
    logger.info('blog', `Blog updated: ${updatedBlog.title} by ${req.user.username}`);
    
    res.status(200).json({
      success: true,
      message: 'Blog updated successfully',
      data: updatedBlog
    });
  } catch (error) {
    logger.error('blog', 'Failed to update blog', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update blog',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/blogs/{id}:
 *   delete:
 *     summary: Delete a blog post
 *     tags: [Blogs]
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
 *         description: Blog deleted successfully
 *       403:
 *         description: Not authorized to delete this blog
 *       404:
 *         description: Blog not found
 */
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      logger.warn('blog', `Blog not found for deletion: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    // Check if user is the author or admin
    if (blog.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      logger.warn('blog', `Unauthorized deletion attempt by ${req.user.username} for blog ${req.params.id}`);
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this blog'
      });
    }
    
    await Blog.findByIdAndDelete(req.params.id);
    
    logger.info('blog', `Blog deleted: ${blog.title} by ${req.user.username}`);
    
    res.status(200).json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    logger.error('blog', 'Failed to delete blog', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete blog',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/blogs/{id}/like:
 *   post:
 *     summary: Like or unlike a blog post
 *     tags: [Blogs]
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
 *         description: Like status updated
 *       404:
 *         description: Blog not found
 */
const likeBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      logger.warn('blog', `Blog not found for like: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    const userId = req.user._id;
    const isLiked = blog.likes.includes(userId);
    
    if (isLiked) {
      blog.likes.pull(userId);
      logger.info('blog', `Blog unliked: ${blog.title} by ${req.user.username}`);
    } else {
      blog.likes.push(userId);
      logger.info('blog', `Blog liked: ${blog.title} by ${req.user.username}`);
    }
    
    await blog.save();
    
    res.status(200).json({
      success: true,
      message: isLiked ? 'Blog unliked' : 'Blog liked',
      data: {
        isLiked: !isLiked,
        likeCount: blog.likes.length
      }
    });
  } catch (error) {
    logger.error('blog', 'Failed to like/unlike blog', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update like status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @swagger
 * /api/blogs/{id}/comments:
 *   post:
 *     summary: Add a comment to a blog post
 *     tags: [Blogs]
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       404:
 *         description: Blog not found
 */
const addComment = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      logger.warn('blog', `Blog not found for comment: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }
    
    const comment = {
      author: req.user._id,
      content: req.body.content
    };
    
    blog.comments.push(comment);
    await blog.save();
    
    await blog.populate('comments.author', 'username firstName lastName avatar');
    const newComment = blog.comments[blog.comments.length - 1];
    
    logger.info('blog', `Comment added to blog: ${blog.title} by ${req.user.username}`);
    
    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: newComment
    });
  } catch (error) {
    logger.error('blog', 'Failed to add comment', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  likeBlog,
  addComment
};
