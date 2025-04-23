// MongoDB connection test script
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Manually read .env file
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
  // Skip comments and empty lines
  if (line.trim().startsWith('#') || !line.trim()) return acc;
  
  const [key, value] = line.split('=');
  if (key && value) {
    // Remove quotes if present
    acc[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
  }
  return acc;
}, {});

const MONGODB_URI = envVars.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env file');
  process.exit(1);
}

console.log('Attempting to connect to MongoDB...');
console.log('Connection string:', MONGODB_URI.replace(/:([^:@]+)@/, ':****@')); // Hide password in logs

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully!');
    console.log('Connection test passed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error);
    console.error('\nPossible issues:');
    console.error('1. Username or password is incorrect');
    console.error('2. IP address is not whitelisted in MongoDB Atlas Network Access');
    console.error('3. Cluster name is incorrect');
    console.error('4. MongoDB Atlas account might have restrictions');
    console.error('\nTo fix:');
    console.error('- Double-check your username and password');
    console.error('- Go to MongoDB Atlas > Network Access and add your current IP address');
    console.error('- Verify the cluster name in your connection string');
    process.exit(1);
  }); 