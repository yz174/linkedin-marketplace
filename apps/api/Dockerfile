# API on the Bun runtime. Build context is the repo root so the workspace
# packages (@lm/*) resolve. Bun runs the TypeScript directly, so there is no
# build output stage.
FROM oven/bun:1.3

WORKDIR /app

# Manifests first for a cached install layer.
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/collab/package.json packages/collab/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/match/package.json packages/match/package.json

RUN bun install --frozen-lockfile --production

# Source the API needs at runtime.
COPY tsconfig.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

ENV NODE_ENV=production
# Render injects PORT; env.ts reads it (falls back to 3001 locally).
EXPOSE 3001

CMD ["bun", "apps/api/src/server.ts"]
