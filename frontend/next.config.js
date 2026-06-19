/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // External packages for server components (no longer experimental in Next.js 15)
  serverExternalPackages: ['typeorm', 'pg', 'redis', 'bullmq'],

  headers: async () => {
    return [
      {
        source: '/api/trpc/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('pg-native');
    }
    return config;
  },

  // Specify output file tracing root to avoid workspace detection warnings
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
