import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@helix/core", "@helix/help"],
  // Avoid Vercel deploy failure: "Cannot patch preview comments when immutable static file upload is enabled"
  experimental: {
    supportsImmutableAssets: false,
  },
};

export default nextConfig;
