# Scribrrr backend for Fly.io

FROM node:22-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/

RUN npm ci --workspace=@scribrrr/server --include=dev

COPY apps/server/tsconfig.json apps/server/
COPY apps/server/src apps/server/src

RUN npm run build --workspace=@scribrrr/server \
  && npm ci --workspace=@scribrrr/server --omit=dev

FROM node:22-bookworm AS runtime

# Chromium system libraries for PDF generation (loaded lazily at runtime).
RUN npx --yes playwright install-deps chromium

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Reuse build-stage node_modules — runtime `npm ci` was a separate install tree.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist

RUN npx playwright install chromium

EXPOSE 8080

CMD ["node", "apps/server/dist/index.js"]
