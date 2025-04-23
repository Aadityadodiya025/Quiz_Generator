import { NextRequest, NextResponse } from 'next/server';

// Global error handler for the summary API route
export function handleError(error: Error, request?: NextRequest) {
  console.error("Summary API route error:", error);
  
  return NextResponse.json(
    {
      success: false,
      message: 'Failed to generate summary: ' + (error.message || 'Unknown error'),
    },
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
} 