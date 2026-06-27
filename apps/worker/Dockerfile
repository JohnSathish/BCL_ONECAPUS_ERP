FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

COPY apps/worker/package.json apps/worker/

COPY apps/api/package.json apps/api/

COPY apps/api/prisma apps/api/prisma/

RUN npm ci -w worker -w api --ignore-scripts



FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY --from=deps /app/package.json ./package.json

COPY --from=deps /app/package-lock.json ./package-lock.json

COPY apps/worker ./apps/worker

COPY apps/api ./apps/api

WORKDIR /app/apps/api

ENV DATABASE_URL=postgresql://nep:nep_dev_password@postgres:5432/nep_erp

RUN rm -f prisma.config.ts && ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

WORKDIR /app/apps/worker

RUN npm run build



FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont postgresql16-client zstd tar \

  && addgroup -g 1001 -S nodejs && adduser -S worker -u 1001

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY --from=builder /app/apps/worker/dist ./dist

COPY --from=builder /app/apps/worker/package.json ./package.json

COPY --from=builder /app/node_modules ./node_modules

# Generated client lives under apps/api after prisma generate.
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/@prisma ./node_modules/@prisma

USER worker

CMD ["node", "dist/main.js"]


