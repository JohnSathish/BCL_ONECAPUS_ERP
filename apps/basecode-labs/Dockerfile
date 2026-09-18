FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# postinstall runs prisma generate; schema is not in this layer yet
RUN npm install --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
ENV DATABASE_URL="file:./data/build.db"
ENV APP_URL="https://basecodelabs.com"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p prisma/data \
  && npx prisma generate \
  && npx prisma db push \
  && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=1610
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p /app/prisma/data
EXPOSE 1610
CMD ["sh", "-c", "mkdir -p prisma/data && npx prisma db push && node prisma/ensure-admin.cjs && npx next start -H 0.0.0.0 -p 1610"]
