import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@helix/core", "@helix/help"],
};

export default nextConfig;
