# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
# node_modules includes the Prisma CLI + tsx so migrations and the optional demo
# seed can run at start-up.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 5000
ENTRYPOINT ["./docker-entrypoint.sh"]
