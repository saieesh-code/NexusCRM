'use strict';

const mongoose = require('mongoose');
const logger   = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    logger.error('MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected: ' + conn.connection.host);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error: ' + err.message);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    return conn;
  } catch (err) {
    logger.error('MongoDB connection failed: ' + err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
