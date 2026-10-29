import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.31.176',
    '192.168.31.*',
    'localhost',
  ],
  async redirects() {
    return [
      // Legacy /maintenance paths gracefully redirected to native root paths
      {
        source: '/maintenance/login',
        destination: '/login',
        permanent: false,
      },
      {
        source: '/maintenance/:company/login',
        destination: '/:company/login',
        permanent: false,
      },
      {
        source: '/maintenance/dashboard/:path*',
        destination: '/dashboard/:path*',
        permanent: false,
      },
      {
        source: '/maintenance/dashboard',
        destination: '/dashboard',
        permanent: false,
      },
      {
        source: '/maintenance/scan/:path*',
        destination: '/scan/:path*',
        permanent: false,
      },
      {
        source: '/maintenance/api/:path*',
        destination: '/api/:path*',
        permanent: false,
      },
      {
        source: '/maintenance',
        destination: '/login',
        permanent: false,
      },
      {
        source: '/maintanance/:path*',
        destination: '/:path*',
        permanent: false,
      },
      {
        source: '/maintanance',
        destination: '/login',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/:company/dashboard',
        destination: '/dashboard',
      },
      {
        source: '/:company/dashboard/:path*',
        destination: '/dashboard/:path*',
      },
      {
        source: '/:company/scan/:path*',
        destination: '/scan/:path*',
      },
    ];
  },
};

export default nextConfig;
