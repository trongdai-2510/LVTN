# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS development-dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM development-dependencies AS builder
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    API_STORAGE_ROOT=/app/storage

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json package-lock.json knexfile.js ./
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node seeds ./seeds

RUN mkdir -p /app/storage && chown node:node /app/storage

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/health/db').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npm run migrate:latest && npm run seed:admin && exec node dist/main.js"]
