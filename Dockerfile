FROM node:22 AS base
WORKDIR /app
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PATH}:${PNPM_HOME}"
RUN npm install -g pnpm@latest-10
RUN pnpm add turbo --global
COPY package.json package.json
COPY pnpm-lock.yaml pnpm-lock.yaml
COPY pnpm-workspace.yaml pnpm-workspace.yaml
COPY turbo.json turbo.json
COPY biome.json biome.json
COPY packages packages

FROM base AS server-prune
COPY apps/server/package.json apps/server/package.json
RUN turbo prune server --docker

FROM base AS www-prune
COPY apps/www/package.json apps/www/package.json
RUN turbo prune www --docker

FROM server-prune AS server-installer
COPY --from=server-prune /app/out/json/ .
RUN pnpm install
COPY apps/server apps/server
RUN turbo prune server --docker
COPY --from=server-prune /app/out/full/ .

FROM www-prune AS www-installer
COPY --from=www-prune /app/out/json/ .
RUN pnpm install
COPY apps/www apps/www
RUN turbo prune www --docker
COPY --from=www-prune /app/out/full/ .

FROM server-installer AS server-builder
RUN pnpm run ci --filter=server
RUN pnpm run build --filter=server

FROM www-installer AS www-builder
RUN pnpm run ci --filter=www
RUN pnpm run build --filter=www

FROM node:22-slim AS runner
WORKDIR /app
COPY --from=server-builder /app/node_modules /app/node_modules
COPY --from=server-builder /app/packages /app/packages
COPY --from=server-builder /app/apps/server/dist /app/apps/server/dist
COPY --from=server-builder /app/apps/server/node_modules /app/apps/server/node_modules
COPY --from=www-builder /app/apps/www/dist /app/apps/www/dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "/app/apps/server/dist/index.js"]
