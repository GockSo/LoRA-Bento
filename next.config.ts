import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: '/api/images',
      },
    ],
  },
};

export default nextConfig;
