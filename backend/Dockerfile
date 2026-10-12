# Production image for the NestJS API.
#
# Two stages: the first has the dev dependencies needed to compile TypeScript,
# the second carries only what the process needs at runtime.
#
# openssl is not optional on Alpine -- Prisma's query engine links against it
# (linux-musl-openssl-3.0.x), and without it the client fails at first query
# with a missing-library error rather than at build time.

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
# Copied before the rest of the source so a change to a controller does not
# invalidate the dependency layer.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
# `npm run build` is `prisma generate && nest build`.
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
# The Prisma CLI is a runtime dependency on purpose: `prisma migrate deploy`
# runs inside this container during a deploy, which is what keeps the database
# reachable only from localhost on the VPS. Resolving the CLI with `npx` at
# deploy time instead would need network access and could pick a different
# version than the one the migrations were written against.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force
# Generated explicitly rather than relying on a postinstall hook firing.
RUN npx prisma generate
COPY --from=build /app/dist ./dist
# Drop privileges. The node image ships an unprivileged `node` user; nothing
# here writes to the image, so ownership does not need changing.
USER node
EXPOSE 5000
CMD ["node", "dist/src/main"]
