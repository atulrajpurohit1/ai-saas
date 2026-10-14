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

# NEXT_PUBLIC_* is inlined into the client bundle at build time, so the API
# origin has to be known HERE -- it cannot be supplied at container start.
# That is why prod and staging are separate builds. Passed by CI; the default
# is the production origin, which is same-origin with the app itself (Caddy
# proxies /api to the backend), so the browser makes no cross-origin request
# and CORS never enters the picture.
ARG NEXT_PUBLIC_API_URL="https://dashboard.aegislead.co/api"
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
