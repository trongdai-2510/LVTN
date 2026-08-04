# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
ARG API_BASE_URL=http://api:4000
ARG NEXT_PUBLIC_API_BASE_URL=/api
ARG NEXT_PUBLIC_PUBLIC_SITE_URL=http://localhost
ARG NEXT_PUBLIC_ADMIN_BASE_PATH=/admin
ENV API_BASE_URL=${API_BASE_URL} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_PUBLIC_SITE_URL=${NEXT_PUBLIC_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_ADMIN_BASE_PATH=${NEXT_PUBLIC_ADMIN_BASE_PATH}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3001 \
    API_BASE_URL=http://api:4000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3001

HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/admin/login').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
