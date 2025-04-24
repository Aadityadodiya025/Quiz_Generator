import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function GET() {
  try {
    console.log('DB Check: Connecting to MongoDB...');
    await dbConnect();
    
    // Get connection status
    const connectionState = mongoose.connection.readyState;
    const connectionStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    
    // Get MongoDB server info
    const serverInfo = await mongoose.connection.db.admin().serverInfo();
    
    return NextResponse.json({
      success: true,
      connectionState: connectionStates[connectionState as keyof typeof connectionStates] || 'unknown',
      serverVersion: serverInfo.version,
      message: 'MongoDB connection is working correctly.',
      database: mongoose.connection.db.databaseName,
      uri: process.env.MONGODB_URI?.replace(/:[^:@]+@/, ':****@') // Redact password
    });
  } catch (error: any) {
    console.error('DB Check Error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to connect to MongoDB',
      error: error.message,
      uri: process.env.MONGODB_URI?.replace(/:[^:@]+@/, ':****@') // Redact password
    }, { status: 500 });
  }
} 