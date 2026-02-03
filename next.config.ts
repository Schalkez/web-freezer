import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Enable Cloudflare Pages compatibility
    runtime: 'edge',
  },
}

export default nextConfig
