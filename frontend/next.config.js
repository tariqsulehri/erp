/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Keep the dev-only Next.js badge away from the sidebar's collapse toggle.
  devIndicators: { position: 'bottom-right' },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: [
      '@tabler/icons-react',
      'date-fns',
      'decimal.js',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('pg-native');
    }
    return config;
  },
  // /api/v1 is served by src/app/api/v1/[...path]/route.ts, which adds the signed-in user's token.

  // Specify output file tracing root to avoid workspace detection warnings
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
