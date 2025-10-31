/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ['lighthouse', 'puppeteer', 'chrome-launcher']
  },
  // Allow serving static files from reports directory
  async rewrites() {
    return [
      {
        source: '/reports/:path*',
        destination: '/api/reports/:path*'
      }
    ];
  }
}

module.exports = nextConfig