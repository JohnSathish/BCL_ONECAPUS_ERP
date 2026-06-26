FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV HUSKY=0
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN npm ci -w web --include=dev --ignore-scripts
# Lockfile may be Windows-generated; install Linux musl native bindings for Alpine.
RUN npm install @tailwindcss/oxide-linux-x64-musl@4.3.0 --workspace=web --no-save \
  && npm rebuild @tailwindcss/oxide lightningcss --workspace=web

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web ./apps/web
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_LOGIN_HOST=erp.donboscocollege.ac.in
ARG NEXT_PUBLIC_CAREER_HOST=career.donboscocollege.ac.in
ARG NEXT_PUBLIC_WS_ORIGIN=
ARG NEXT_PUBLIC_SHOW_DEMO_LOGIN=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_LOGIN_HOST=$NEXT_PUBLIC_LOGIN_HOST
ENV NEXT_PUBLIC_CAREER_HOST=$NEXT_PUBLIC_CAREER_HOST
ENV NEXT_PUBLIC_WS_ORIGIN=$NEXT_PUBLIC_WS_ORIGIN
ENV NEXT_PUBLIC_SHOW_DEMO_LOGIN=$NEXT_PUBLIC_SHOW_DEMO_LOGIN
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1
CMD ["node", "apps/web/server.js"]
