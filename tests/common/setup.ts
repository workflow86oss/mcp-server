// Test setup file
import { jest } from '@jest/globals';

// Set up environment variables for testing
// Use environment variables if set, otherwise fall back to defaults
if (!process.env.W86_API_KEY) {
  process.env.W86_API_KEY = 'test-api-key';
}
if (!process.env.W86_DOMAIN) {
  process.env.W86_DOMAIN = 'http://localhost:9000';
}