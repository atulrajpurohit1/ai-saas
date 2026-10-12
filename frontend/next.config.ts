import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone: the server plus only the node_modules files the
  // build actually traced. The production image copies that instead of a full
  // `npm ci --omit=dev` tree, which is the difference between a ~200MB image
  // and a ~1GB one on a VPS that also hosts Postgres.
  //
  // Vercel ignores this setting, so staging is unaffected.
  output: "standalone",

  // Without this, Next walks up looking for a lockfile, finds the one at the
  // repo root, treats that as the workspace root and emits
  // .next/standalone/frontend/server.js instead of .next/standalone/server.js.
  // The Docker build (context ./frontend, no parent lockfile) would then
  // produce a different layout than a local build, so the path in the
  // Dockerfile would be right in one and wrong in the other. Pinning the root
  // makes both flat.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
