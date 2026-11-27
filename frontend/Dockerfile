# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm-slim AS build
COPY --from=ghcr.io/pnpm/pnpm:12.3.4 /opt/pnpm /opt/pnpm
ENV PATH="/opt/pnpm:${PATH}" CI=true NG_CLI_ANALYTICS=false
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store
COPY angular.json tsconfig.json tsconfig.app.json .postcssrc.json ./
COPY src/ src/
COPY public/ public/
RUN pnpm run build

FROM build AS production-dependencies
RUN pnpm prune --prod --ignore-scripts

FROM node:24.22.1-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=4000 TZ=America/Lima
WORKDIR /app
COPY --from=build --chown=node:node /app/dist/saip-frontend/ dist/saip-frontend/
COPY --from=production-dependencies --chown=node:node /app/node_modules/ node_modules/
COPY --from=build --chown=node:node /app/package.json package.json
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/login').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/saip-frontend/server/server.mjs"]
