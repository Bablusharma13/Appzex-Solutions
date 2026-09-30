import type { NextConfig } from 'next';

/**
 * Optional same-origin proxy. When BACKEND_URL is set (e.g. on Vercel) and
 * NEXT_PUBLIC_API_URL=/api, the browser talks to /api on the frontend origin
 * and Next forwards to the API. The session cookie is then first-party, which
 * avoids third-party-cookie blocking when frontend and API are on different
 * domains.
 */
const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, '');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Standalone output is only needed for the Docker image (see Dockerfile).
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  poweredByHeader: false,
  async rewrites() {
    return backendUrl ? [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }] : [];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
