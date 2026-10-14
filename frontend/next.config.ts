import type { NextConfig } from "next";

// Only the Docker image wants Next's standalone output. Vercel has its own
// build pipeline and its own idea of where build artifacts live, and setting
// these unconditionally broke it:
//
//   ENOENT: no such file or directory, lstat
//   '/vercel/path0/.next/routes-manifest-deterministic.json'
//
// `output: "standalone"` changes the shape of .next/, so Vercel's post-build
// step went looking for a manifest that was no longer where it expected.
// `outputFileTracingRoot: process.cwd()` is the same kind of hazard there,
// because Vercel does not necessarily run the build from the project
// directory. Gating both on a variable that only the Dockerfile sets keeps
// Vercel's build byte-for-byte what it was before any of this work.
const isContainerBuild = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isContainerBuild
    ? {
        // Emits .next/standalone: a self-contained server.js plus only the
        // node_modules files the traced routes actually import. The image
        // copies that instead of installing dependencies, which is what keeps
        // the runtime layer small.
        output: "standalone" as const,

        // Pinned to this directory, which is where `next build` runs from.
        // Without it, Next picks the tracing root by walking up for a lockfile
        // and finds the repo root one level up -- which nests the output at
        // .next/standalone/frontend/server.js locally but NOT inside Docker,
        // where the build context is this directory alone and no parent
        // lockfile exists. The Dockerfile would then copy a layout that
        // differs from the one anyone reproduces by hand. Nothing outside this
        // directory is imported, so narrowing the root costs nothing.
        outputFileTracingRoot: process.cwd(),
      }
    : {}),
};

export default nextConfig;
