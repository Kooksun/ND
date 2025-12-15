import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/ND',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
