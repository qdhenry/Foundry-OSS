import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  // TypeScript's tsc doesn't follow git symlinks on Vercel Linux;
  // webpack compilation succeeds (via resolve.alias below).
  // Track fix: replace convex symlink with proper tsconfig paths.
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    // Vercel doesn't follow git symlinks. Explicitly alias apps/web/convex
    // to the monorepo root convex/ so relative imports like
    // ../../../../convex/_generated/api resolve correctly in production.
    config.resolve.alias = {
      ...config.resolve.alias,
      [path.join(__dirname, "convex")]: path.resolve(__dirname, "../../convex"),
    };
    return config;
  },
};

export default nextConfig;
