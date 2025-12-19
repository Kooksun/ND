import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {
  output: 'export',
  // GitHub Pages treats the repo name as a subpath, so we need a basePath.
  basePath: isGithubActions ? '/ND' : '',
  // Use trailingSlash to ensure routes work correctly on static hosting.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
