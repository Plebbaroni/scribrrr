# Scribrrr backend for Fly.io / Railway (WebSockets + Playwright PDF).
# Deploy the Next.js client separately on Vercel — it must not install Chromium.

FROM node:22-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/

RUN npm ci --workspace=@scribrrr/server --include=dev

COPY apps/server/tsconfig.json apps/server/
COPY apps/server/src apps/server/src

RUN npm run build --workspace=@scribrrr/server

RUN npm ci --workspace=@scribrrr/server --omit=dev

# Official Playwright image includes Chromium + OS deps (matches playwright npm package).
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist

EXPOSE 8080

CMD ["node", "apps/server/dist/index.js"]
