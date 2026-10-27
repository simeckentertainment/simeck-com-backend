require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

// Import configurations
const { connectDB, ensureConnection } = require('./config/database');
const swaggerSpecs = require('./config/swagger');
const { logger, httpLogger } = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const blogRoutes = require('./routes/blogs');
const contactRoutes = require('./routes/contacts');

const app = express();

// Trust proxy for Vercel deployment (required for rate limiting)
app.set('trust proxy', 1);

// Connect to database immediately on startup
connectDB().catch(err => {
  console.error('[app] Failed to connect to database on startup:', err);
});

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Rate limiting with custom keyGenerator for Vercel Forwarded header
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, _res) => {
    let clientIp = req.ip;

    // Prefer RFC 7239 Forwarded header if present: e.g. 'for=203.0.113.5;proto=https;by=...'
    const fwd = req.headers['forwarded'];
    if (typeof fwd === 'string') {
      const m = /for="?([^;," ]+)/i.exec(fwd); // first for= value
      if (m?.[1]) {
        clientIp = m[1].replace(/^\[|\]$/g, ''); // strip IPv6 brackets
      }
    } else {
      // Fallback to X-Forwarded-For (may be a list)
      const xff = req.headers['x-forwarded-for'];
      if (typeof xff === 'string') {
        clientIp = xff.split(',')[0].trim();
      } else if (Array.isArray(xff) && xff.length) {
        clientIp = xff[0].split(',')[0].trim();
      }
    }

    // Use ipKeyGenerator helper to properly handle IPv6 addresses
    return ipKeyGenerator(clientIp);
  },
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(httpLogger);

// Database connection middleware - ensure DB is ready before processing requests
app.use(async (req, res, next) => {
  try {
    const isConnected = await ensureConnection();
    if (!isConnected) {
      throw new Error('Database connection not established');
    }
    next();
  } catch (error) {
    console.error('[middleware] Database connection error:', error.message);
    res.status(503).json({
      success: false,
      message: 'Database service unavailable. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  logger.info('health', 'Health check requested');
  
  const mongoose = require('mongoose');
  const connectionStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: {
      state: connectionStates[mongoose.connection.readyState],
      stateCode: mongoose.connection.readyState,
      host: mongoose.connection.host || 'not connected',
      mongodbUriSet: !!process.env.MONGODB_URI
    }
  });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CORS is working',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// Favicon routes to prevent 404 errors
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.get('/favicon.png', (_req, res) => res.status(204).end());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/contacts', contactRoutes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Simeck Blog API Documentation'
}));

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Simeck Blog API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      auth: '/api/auth',
      blogs: '/api/blogs',
      contacts: '/api/contacts',
      health: '/health'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn('404', `Route not found: ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logger.error('global', 'Unhandled error occurred', error);
  
  // CORS error
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation'
    });
  }
  
  // Default error response
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Only start server if not in serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info('server', `Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    logger.info('server', `API Documentation available at http://localhost:${PORT}/api-docs`);
  });
}

module.exports = app;
