import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@helix/core", "@helix/help"],
  experimental: {
    supportsImmutableAssets: false,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // I3: ensure the kb/*.md source files are bundled into the serverless
  // trace for every API route (kb-store.ts is read from route handlers
  // under /api/messages/**), not just from whatever happens to get pulled
  // in automatically — Next.js file-tracing can otherwise miss a directory
  // that's only read via fs.readdirSync at runtime with no static import.
  outputFileTracingIncludes: {
    "/*": ["./kb/**/*.md"],
  },
};

export default nextConfig;
