import path from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, "../web/src")}/`,
      },
      {
        find: "next/link",
        replacement: path.resolve(__dirname, "./src/shims/next-link.tsx"),
      },
      {
        find: "next/dynamic",
        replacement: path.resolve(__dirname, "./src/shims/next-dynamic.tsx"),
      },
      {
        find: "next/navigation",
        replacement: path.resolve(__dirname, "./src/shims/next-navigation.ts"),
      },
      {
        find: "@clerk/nextjs",
        replacement: path.resolve(__dirname, "./src/shims/clerk-nextjs.tsx"),
      },
      {
        find: "@foundry/ui/backend",
        replacement: path.resolve(__dirname, "../../packages/ui/src/backend.tsx"),
      },
      {
        find: /^@foundry\/ui\/(.*)$/,
        replacement: path.resolve(__dirname, "../../packages/ui/src/$1"),
      },
      {
        find: "@foundry/ui",
        replacement: path.resolve(__dirname, "../../packages/ui/src/index.ts"),
      },
      {
        find: "@foundry/types/sandbox",
        replacement: path.resolve(__dirname, "../../packages/types/src/sandbox.ts"),
      },
      {
        find: /^@foundry\/types\/(.*)$/,
        replacement: path.resolve(__dirname, "../../packages/types/src/$1"),
      },
      {
        find: "@foundry/types",
        replacement: path.resolve(__dirname, "../../packages/types/src/index.ts"),
      },
    ],
  },
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ["@foundry/ui", "@foundry/types"],
  },
});
