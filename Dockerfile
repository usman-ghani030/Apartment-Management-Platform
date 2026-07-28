# ─── Stage 1: Install dependencies & build ───────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy everything (respects .dockerignore — excludes node_modules, .git, etc.)
COPY . .

# Install ALL workspace dependencies (use npm install for broader compatibility)
RUN npm install --include-workspace-root

# Build shared package first (backend depends on it)
RUN npm run build -w @apartment/shared

# Generate Prisma client
RUN cd backend && npx prisma generate

# Build backend
RUN npm run build -w @apartment/backend

# ─── Stage 2: Production image ───────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/package-lock.json package-lock.json
COPY --from=builder /app/backend/dist backend/dist
COPY --from=builder /app/backend/node_modules backend/node_modules
COPY --from=builder /app/backend/prisma backend/prisma
COPY --from=builder /app/backend/package.json backend/package.json
COPY --from=builder /app/shared shared
COPY --from=builder /app/node_modules node_modules

# Create uploads directory for file uploads at runtime
RUN mkdir -p backend/uploads

EXPOSE 4000

# Run migrations on startup, then start the server
CMD ["sh", "-c", "cd backend && npx prisma migrate deploy && node dist/index.js"]
