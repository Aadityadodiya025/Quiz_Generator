import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only apply to /api routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Set the content-type headers explicitly for all API routes
    const headers = new Headers(request.headers);
    
    // Always accept JSON
    headers.set('Accept', 'application/json');
    
    // Add CORS headers for API routes
    const response = NextResponse.next({
      request: {
        headers,
      },
    });
    
    // Add CORS headers to the response
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Set cache control headers to prevent caching errors
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
} 