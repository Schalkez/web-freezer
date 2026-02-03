import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // OpenNext Cloudflare adapter configuration
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
