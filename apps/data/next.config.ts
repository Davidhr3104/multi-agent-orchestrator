import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@helix/core", "@helix/ui"],
  experimental: {
    supportsImmutableAssets: false,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
