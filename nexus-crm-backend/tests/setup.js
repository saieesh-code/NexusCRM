/**
 * Jest global setup — load env before any test module imports
 */

process.env.NODE_ENV        = 'test';
process.env.JWT_SECRET      = 'test_jwt_secret_at_least_32_characters_long';
process.env.JWT_EXPIRES_IN  = '1h';
process.env.JWT_REFRESH_SECRET  = 'test_refresh_secret_also_32_chars_ok';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.MONGO_URI       = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/nexus_crm_test';
process.env.PORT            = '5001';
process.env.API_VERSION     = 'v1';
process.env.CORS_ORIGINS    = 'http://localhost:3000';
