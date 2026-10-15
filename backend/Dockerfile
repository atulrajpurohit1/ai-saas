# NestJS API image.
#
# Base is Debian slim, not Alpine, on purpose: Prisma ships prebuilt query
# engines per libc, and the musl variants need extra openssl juggling that
# breaks quietly on upgrade. Debian's `debian-openssl-3.0.x` engine is the
# path Prisma tests most.
FROM node:24-bookworm-slim AS deps
WORKDIR /app

# bcrypt and pdfkit compile from source when no prebuild matches this
# platform, so the toolchain has to exist in the stage that installs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copied separately from the source so an edit to src/ reuses the cached
# install layer instead of reinstalling several hundred packages.
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app
COPY . .
# `npm run build` is `prisma generate && nest build`, so this produces both the
# generated client and dist/.
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# node_modules is copied WHOLE rather than reinstalled with --omit=dev. The
# dev tree carries the `prisma` CLI, and `prisma migrate deploy` is what
# applies migrations on every deploy -- a production-only install would leave
# the deploy with no way to migrate. The cost is image size; the alternative
# is a second image built only to run migrations.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

# Run unprivileged. The `node` user ships with the image at uid 1000.
USER node

EXPOSE 5000

# Shallow probe only -- see the comment in health.controller.ts for why this
# must not check the database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:5000/api/health/live || exit 1

# dist/src/main because the Nest build keeps the src/ directory level (the
# same path backend's own `start:prod` script uses).
CMD ["node", "dist/src/main"]
