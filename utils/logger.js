const morgan = require('morgan');

// Custom logging function with feature tags
const logger = {
  info: (feature, message) => {
    console.log(`[${feature}] ${new Date().toISOString()} - ${message}`);
  },
  
  error: (feature, message, error = null) => {
    console.error(`[${feature}] ${new Date().toISOString()} - ${message}`, error ? error.stack : '');
  },
  
  warn: (feature, message) => {
    console.warn(`[${feature}] ${new Date().toISOString()} - ${message}`);
  },
  
  debug: (feature, message) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${feature}] ${new Date().toISOString()} - DEBUG: ${message}`);
    }
  }
};

// Morgan middleware for HTTP request logging
const httpLogger = morgan('combined', {
  stream: {
    write: (message) => {
      logger.info('http', message.trim());
    }
  }
});

module.exports = { logger, httpLogger };
