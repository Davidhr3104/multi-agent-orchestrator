import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server binds 0.0.0.0 but is previewed via 127.0.0.1 / other
  // hosts, which Next.js treats as cross-origin and blocks by default.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
