# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc* ./
COPY package.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/core/tsconfig.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/server/tsconfig.json apps/server/

RUN pnpm install --frozen-lockfile --filter server...

COPY packages/core/src packages/core/src/
COPY apps/server/prisma apps/server/prisma/
COPY apps/server/src apps/server/src/

RUN pnpm --filter server build
RUN pnpm --filter server prisma generate

# Production stage
FROM node:22-alpine AS production
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY --from=builder /app/node_modules/.pnpm /app/node_modules/.pnpm
COPY --from=builder /app/packages/core/package.json /app/packages/core/
COPY --from=builder /app/packages/core/dist /app/packages/core/
COPY --from=builder /app/apps/server/dist /app/apps/server/
COPY --from=builder /app/apps/server/prisma /app/apps/server/prisma/
COPY --from=builder /app/apps/server/node_modules /app/apps/server/node_modules/
COPY --from=builder /app/node_modules /app/node_modules/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/server/dist/main.js"]