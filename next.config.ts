import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [

      {
        pathname: '/api/images',
      },
      {
        pathname: '/api/projects/**',
      },
    ],
  },
};

export default nextConfig;
