FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci -w api --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY apps/api ./apps/api
WORKDIR /app/apps/api
ENV DATABASE_URL=postgresql://nep:nep_dev_password@postgres:5432/nep_erp
# Nest compile of this monorepo exceeds Node's default heap in Docker builders.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN rm -f prisma.config.ts && ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma
RUN npm run build:docker

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget su-exec \
  && addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/scripts ./apps/api/scripts
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
WORKDIR /app/apps/api
USER root
EXPOSE 3001
ENTRYPOINT ["docker-entrypoint.sh"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health/live || exit 1
CMD ["node", "dist/main.js"]
