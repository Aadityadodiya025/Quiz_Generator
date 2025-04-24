/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdf-parse'],
  // Disable the automatic static optimization for API routes
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // Config for Next.js server
  serverRuntimeConfig: {
    // Will only be available on the server side
    apiTimeout: 60000, // 60 seconds
  },
  publicRuntimeConfig: {
    // Will be available on both server and client
    apiUrl: process.env.API_URL || 'http://localhost:3000',
  },
  // Configure body parser
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig 