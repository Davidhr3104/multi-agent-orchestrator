import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@helix/core", "@helix/help"],
  serverExternalPackages: ["unpdf"],
  // Dev: Playwright / tools hitting 127.0.0.1 while Next binds as localhost
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Avoid Vercel deploy failure with immutable static uploads on Next 16.3
  experimental: {
    supportsImmutableAssets: false,
  },
};

export default nextConfig;
