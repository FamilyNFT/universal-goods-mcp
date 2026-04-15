FROM oven/bun:1 AS builder
WORKDIR /repo

# Copy monorepo workspace files
COPY package.json tsconfig.base.json bun.lock ./
COPY apps/mcp ./apps/mcp

# Trim workspaces to only what we need
RUN bun -e 'const pkg = require("./package.json"); pkg.workspaces = ["apps/mcp"]; require("fs").writeFileSync("./package.json", JSON.stringify(pkg, null, 2))'

RUN bun install
RUN bun run --cwd ./apps/mcp build

# Runtime image
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /repo/apps/mcp/dist ./dist
COPY --from=builder /repo/node_modules ./node_modules

EXPOSE 3100
CMD ["node", "dist/index.js"]
