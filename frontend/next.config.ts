import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone -- a self-contained server.js plus only the
  // node_modules files the traced routes actually import. The production
  // Docker image copies that instead of installing dependencies, which is
  // what keeps the runtime layer small enough for a modest VPS.
  //
  // Vercel ignores this setting, so staging builds are unaffected.
  output: "standalone",

  // Pinned to this directory, which is where `next build` runs from. Without
  // it, Next picks the tracing root by walking up for a lockfile and finds the
  // repo root one level up -- which nests the output at
  // .next/standalone/frontend/server.js locally but NOT inside Docker, where
  // the build context is this directory alone and no parent lockfile exists.
  // The Dockerfile would then copy a layout that differs from the one anyone
  // reproduces by hand. Nothing outside this directory is imported (verified:
  // the traced output contains no sibling node_modules), so narrowing the root
  // costs nothing.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
