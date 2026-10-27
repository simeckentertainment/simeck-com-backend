const mongoose = require('mongoose');

// Disable mongoose buffering globally for serverless
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 30000);

let cachedConnection = null;

const connectDB = async () => {
  try {
    // Return cached connection if exists and is active
    if (cachedConnection && mongoose.connection.readyState === 1) {
      console.log('[database] Using cached MongoDB connection');
      return cachedConnection;
    }

    // If currently connecting, wait for it
    if (mongoose.connection.readyState === 2) {
      console.log('[database] Connection in progress, waiting...');
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve);
      });
      return mongoose.connection;
    }

    // Validate MongoDB URI
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error('[database] MONGODB_URI environment variable is not set');
      console.error('[database] Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGO')));
      throw new Error('MONGODB_URI is required');
    }

    console.log('[database] Connecting to MongoDB...');
    console.log('[database] Connection state before connect:', mongoose.connection.readyState);
    
    // Mongoose connection options optimized for serverless
    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10,
      minPoolSize: 1,
    };
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, options);
    
    cachedConnection = mongoose.connection;
    console.log(`[database] MongoDB Connected: ${mongoose.connection.host}`);
    console.log('[database] Connection state after connect:', mongoose.connection.readyState);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('[database] MongoDB connection error:', err);
      cachedConnection = null;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('[database] MongoDB disconnected');
      cachedConnection = null;
    });

    return cachedConnection;
  } catch (error) {
    console.error('[database] Connection error:', error);
    cachedConnection = null;
    throw error;
  }
};

// Export connection state checker
const ensureConnection = async () => {
  try {
    // Force connection attempt
    await connectDB();
    
    // Verify connection is established
    if (mongoose.connection.readyState !== 1) {
      throw new Error(`Database not ready. Connection state: ${mongoose.connection.readyState}`);
    }
    
    return true;
  } catch (error) {
    console.error('[database] ensureConnection error:', error.message);
    throw error;
  }
};

module.exports = { connectDB, ensureConnection };
