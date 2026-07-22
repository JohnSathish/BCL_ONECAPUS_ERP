FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV HUSKY=0
COPY .npmrc package.json package-lock.json ./
COPY apps/college-web/package.json ./apps/college-web/
RUN npm ci -w @onecampus/college-web --include=dev --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY --from=deps /app/apps/college-web/node_modules ./apps/college-web/node_modules
COPY apps/college-web ./apps/college-web
WORKDIR /app/apps/college-web
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SITE_URL=https://donboscocollege.ac.in
ARG NEXT_PUBLIC_TENANT_SLUG=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_TENANT_SLUG=$NEXT_PUBLIC_TENANT_SLUG
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/college-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/college-web/.next/static ./apps/college-web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/college-web/public ./apps/college-web/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1
CMD ["node", "apps/college-web/server.js"]
