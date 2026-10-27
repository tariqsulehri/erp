FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runner

# Version facts shown by deployment/status.sh (set by deployment/build-and-push.sh).
ARG APP_VERSION=dev
ARG GIT_COMMIT=unknown
LABEL org.opencontainers.image.title="ERP backend" \
      org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.revision="$GIT_COMMIT" \
      org.opencontainers.image.source="https://github.com/tariqsulehri/erp"
ENV APP_VERSION=$APP_VERSION GIT_COMMIT=$GIT_COMMIT

WORKDIR /app

ENV NODE_ENV=production
# The same image runs database jobs: `migrate deploy`, the fresh install script and the first Admin seed.
ENV PRISMA_CMD="node node_modules/prisma/build/index.js"

# psql and pg_dump (version 17 can back up PostgreSQL 17 and older) for the install script and backups.
RUN apk add --no-cache curl postgresql17-client

COPY package*.json ./
# Runtime packages, plus the Prisma CLI (a dev dependency) with all of its own dependencies so
# migrations can run from this image. The CLI version is the exact one from package-lock.json.
RUN npm ci --omit=dev \
  && npm install --no-save --omit=dev "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
  && npm cache clean --force

# Generated Prisma client for this schema.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY scripts ./scripts

RUN chown -R node:node /app

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 4000) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

CMD ["node", "dist/server.js"]
