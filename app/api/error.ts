import { NextRequest, NextResponse } from 'next/server';

export function errorHandler(error: Error, request: NextRequest) {
  console.error('API error:', error);

  // Ensure we return a proper JSON response
  return NextResponse.json(
    {
      success: false,
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : `Error: ${error.message}`
    },
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
} 