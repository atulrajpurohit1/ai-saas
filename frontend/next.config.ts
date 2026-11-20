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

const apiOrigin = (() => {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (!configured || configured.startsWith("/")) return "";
  try {
    return new URL(configured).origin;
  } catch {
    return "";
  }
})();

// The platform console is a small, self-contained surface, so it can carry a
// tighter CSP than the customer app (which uses maps and remote media). Next's
// runtime currently needs inline bootstrap/style support; every other source is
// restricted to this origin and the explicitly configured API origin.
const platformCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/super-admin/:path*",
        headers: [
          { key: "Content-Security-Policy", value: platformCsp },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },

  // /signup has never been a route: the register form lives on the login page
  // and opens with ?register=1. People and outside links still guess the
  // conventional URL and land on a 404, so alias it. Next passes the incoming
  // query string through and merges it with the one below, so
  // /signup?next=/settings/plan still lands on pricing after sign-up.
  //
  // Deliberately not permanent: a 308 is cached by the browser more or less
  // forever, which would break a real /signup page if one is ever added.
  async redirects() {
    return [
      {
        source: "/signup",
        destination: "/login?register=1",
        permanent: false,
      },
    ];
  },

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
