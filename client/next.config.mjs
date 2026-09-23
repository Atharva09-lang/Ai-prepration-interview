import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Where /api/* is proxied to. Set API_PROXY_TARGET on the frontend host to the
// deployed API origin; falls back to NEXT_PUBLIC_API_URL, then to localhost.
const API_TARGET = (
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000'
).replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_TARGET}/api/:path*` }];
  },
};

export default nextConfig;
