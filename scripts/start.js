/**
 * Clean start script - clears any session storage data that might cause issues
 * Run this with "node scripts/start.js" before starting the app
 */

// This script would normally interact with browser APIs
// In a real implementation, you would need to use this in a browser context
// This is just a reference implementation

console.log("Clearing session storage...");

// In a browser context, you would do:
// sessionStorage.clear();
// localStorage.clear();

console.log("Starting app...");
console.log("Run 'npm run dev' to start the development server");

// Execute next build and start for production
// In a production environment, you might run:
// const { execSync } = require('child_process');
// execSync('npm run build && npm run start', {stdio: 'inherit'}); 