/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the dev-only Next.js badge away from the sidebar's collapse toggle.
  devIndicators: { position: 'bottom-right' },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('pg-native');
    }
    return config;
  },
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_API_INTERNAL_URL ||
      (process.env.NEXT_PUBLIC_BACKEND_API_URL && !process.env.NEXT_PUBLIC_BACKEND_API_URL.startsWith('/')
        ? process.env.NEXT_PUBLIC_BACKEND_API_URL
        : 'http://localhost:4000/api/v1');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },

  // Specify output file tracing root to avoid workspace detection warnings
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
