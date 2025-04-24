// lib/mongodb.ts
import mongoose from "mongoose"
import { MongoClient } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env')
}

// Cache MongoDB clients for reuse
let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

/**
 * Connect to database with MongoDB native driver and return db and client
 * This is used by API routes that need direct MongoDB client access
 */
export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    // Use cached connection if available
    console.log('Using cached MongoDB connection');
    return { db: cachedDb, client: cachedClient };
  }

  try {
    console.log('Creating new MongoDB connection...');
    // Parse connection string to get database name
    const uri = MONGODB_URI;
    
    // Options for MongoDB client
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    };

    // Connect to MongoDB
    const client = new MongoClient(uri, options);
    await client.connect();
    
    // Get the database name from connection string or use default
    const dbName = new URL(uri).pathname?.substring(1) || 'quiz_app';
    const db = client.db(dbName);
    
    // Cache the client and db connection
    cachedClient = client;
    cachedDb = db;
    
    console.log('New MongoDB connection established');
    return { db, client };
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error('Failed to connect to database');
  }
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
// Add mongoose to the NodeJS global type
declare global {
  var mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
    isConnecting: boolean;
    lastConnectionAttempt: number;
    connectionAttempts: number;
  };
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
    isConnecting: false,
    lastConnectionAttempt: 0,
    connectionAttempts: 0
  }
}

// Create a health check endpoint to verify MongoDB connection status
export async function checkDbHealth() {
  try {
    if (!cached.conn) {
      return { 
        connected: false, 
        status: 'No connection established'
      };
    }
    
    if (mongoose.connection.readyState !== 1) {
      return { 
        connected: false, 
        status: `Connection not ready: ${getConnectionState(mongoose.connection.readyState)}`
      };
    }
    
    // Try a simple ping to ensure the connection is working
    const result = await mongoose.connection.db.admin().ping();
    return { 
      connected: true,
      status: 'Connected and healthy',
      ping: result
    };
  } catch (error: any) {
    return {
      connected: false,
      status: 'Connection error',
      error: error.message
    };
  }
}

// Get readable connection state description
function getConnectionState(state: number): string {
  switch (state) {
    case 0: return 'disconnected';
    case 1: return 'connected';
    case 2: return 'connecting';
    case 3: return 'disconnecting';
    default: return 'unknown';
  }
}

async function dbConnect() {
  // If already connected, return existing connection
  if (cached.conn) {
    console.log('Using existing MongoDB connection')
    return cached.conn
  }
  
  // Check connection timing to prevent connection storms
  const currentTime = Date.now();
  const minTimeBetweenAttempts = 2000; // 2 seconds
  
  if (cached.isConnecting) {
    console.log('MongoDB connection already in progress, waiting for existing attempt')
    if (cached.promise) {
      try {
        return await cached.promise;
      } catch (error) {
        // If the existing promise fails, we'll try again below
        console.error('Existing connection attempt failed:', error);
      }
    }
  }
  
  // Apply backoff if connecting too frequently
  if (cached.lastConnectionAttempt > 0) {
    const timeSinceLastAttempt = currentTime - cached.lastConnectionAttempt;
    if (timeSinceLastAttempt < minTimeBetweenAttempts) {
      const waitTime = minTimeBetweenAttempts - timeSinceLastAttempt;
      console.log(`Rate limiting MongoDB connection attempt, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Mark that we're attempting to connect
  cached.isConnecting = true;
  cached.lastConnectionAttempt = Date.now();
  cached.connectionAttempts++;
  
  // Exponential backoff for retries
  const backoffTime = Math.min(30000, 1000 * Math.pow(2, Math.min(cached.connectionAttempts - 1, 5)));
  
  const opts = {
    bufferCommands: false,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4, skip trying IPv6
    retryWrites: true,
    retryReads: true,
    connectTimeoutMS: 30000,
    // Remove keepAlive and keepAliveInitialDelay as they're not supported
    // Add additional options for better reliability
    autoIndex: true,
    autoCreate: true,
    writeConcern: { w: 'majority' },
    readPreference: 'primary'
  }

  console.log(`Attempting MongoDB connection (attempt #${cached.connectionAttempts})...`)
  
  // Connect with retry logic
  cached.promise = (async () => {
    try {
      const mongoose = await tryConnect(MONGODB_URI, opts, 3);
      console.log('MongoDB connected successfully!')
      
      // Set up event handlers for the connection
      setupConnectionHandlers(mongoose);
      
      // Reset connection attempts on success
      cached.connectionAttempts = 0;
      return mongoose;
    } catch (error: any) {
      console.error('Failed to connect to MongoDB after multiple attempts:', error);
      // Clear connection state to allow retry on next request
      cached.isConnecting = false;
      cached.promise = null;
      throw new Error(`MongoDB connection failed: ${error.message || 'Unknown error'}`);
    }
  })();
  
  try {
    console.log('Awaiting MongoDB connection...')
    cached.conn = await cached.promise
    cached.isConnecting = false;
    return cached.conn
  } catch (error: any) {
    cached.isConnecting = false;
    console.error('Error establishing MongoDB connection:', error)
    const errorMessage = error.message || 'Unknown MongoDB connection error'
    throw new Error(`MongoDB connection failed: ${errorMessage}`)
  }
}

// Helper function to attempt connection with retries
async function tryConnect(uri: string, options: any, maxRetries = 3): Promise<typeof mongoose> {
  let lastError;
  
  // Try a simplified connection approach first
  try {
    console.log('Attempting simplified MongoDB connection...');
    // Try with minimal options first
    return await mongoose.connect(uri, { 
      serverSelectionTimeoutMS: 10000, 
      connectTimeoutMS: 10000
    });
  } catch (simpleError: any) {
    console.error('Simplified connection failed:', simpleError.message);
    // Continue with retry attempts if simplified approach fails
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Connection attempt ${attempt}/${maxRetries}...`);
      // Use only the essential options to avoid compatibility issues
      const safeOptions = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
        retryWrites: true,
        retryReads: true,
        connectTimeoutMS: 10000,
        autoIndex: true,
        autoCreate: true
      };
      return await mongoose.connect(uri, safeOptions);
    } catch (error: any) {
      lastError = error;
      console.error(`Connection attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// Set up connection event handlers
function setupConnectionHandlers(mongoose: typeof import("mongoose")) {
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
    // Only reset if the error is serious enough
    if (err.name !== 'MongoNetworkTimeoutError') {
      cached.conn = null;
      cached.promise = null;
    }
  });
  
  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
    cached.conn = null;
    cached.promise = null;
    cached.isConnecting = false;
    // Reset connection attempt counter as we're starting fresh
    cached.connectionAttempts = 0;
  });
  
  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });
  
  // Graceful shutdown handling
  process.on('SIGINT', async () => {
    if (cached.conn) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    }
  });
}

export default dbConnect
