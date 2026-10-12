# Production image for the Next.js frontend.
#
# Depends on `output: "standalone"` in next.config.ts: the runtime stage copies
# the traced server instead of installing node_modules again.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so
# this cannot be an env var set at `docker run`. The default suits production,
# where Nginx serves the API under the same origin as the app; a build aimed at
# a separate API host passes --build-arg.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# server.js reads both; without HOSTNAME it binds localhost inside the
# container and Nginx cannot reach it.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# standalone deliberately excludes these two (they are meant for a CDN), so
# they are copied in for Nginx to serve from this container.
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
