# Next.js frontend image.
#
# Build context is this directory, not the repo root. That matters: Next picks
# its output-file-tracing root by walking up for a lockfile, so a context that
# included the repo's own package-lock.json would nest the standalone output
# one directory deeper and break the copy paths below.
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* is inlined into the client bundle at build time, so this cannot
# be supplied at container start -- it is fixed when the image is built.
#
# The value is RELATIVE on purpose. Caddy serves the app and the API on one
# origin, so "/api" resolves against whatever host the page was loaded from.
# Three things follow:
#   - no cross-origin request is ever made, so CORS never enters the picture;
#   - the SAME image runs correctly on any hostname, which is what lets the
#     full stack be tested on a temporary domain before dashboard.aegislead.co
#     is pointed at this box;
#   - changing the production domain needs no rebuild.
# This is only safe because every API call happens in the browser (verified:
# no server component imports the api client), so there is no server-side
# request for which a relative URL would be meaningless.
ARG NEXT_PUBLIC_API_URL="/api"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# server.js binds localhost unless told otherwise, which would be unreachable
# from Caddy in another container.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# standalone/ deliberately omits public/ and .next/static (Next assumes a CDN
# serves them); copied in explicitly so server.js serves them itself.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/public ./public
COPY --from=build /app/.next/static ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/ -o /dev/null || exit 1

CMD ["node", "server.js"]
