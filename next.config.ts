import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.lulgo.com' }],
        destination: 'https://lulgo.com/:path*',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
