# ─── Stage 1: Install dependencies & build ───────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
# Required for npm workspaces resolution
COPY frontend/package.json frontend/

# Install ALL workspace dependencies (this links @apartment/shared)
RUN npm ci --include-workspace-root

# Copy source code
COPY shared/ shared/
COPY backend/ backend/

# Build shared package first (backend depends on it)
RUN npm run build -w @apartment/shared

# Generate Prisma client
RUN cd backend && npx prisma generate

# Build backend
RUN npm run build -w @apartment/backend

# ─── Stage 2: Production image ───────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copy built artifacts from builder stage (node_modules includes Prisma CLI for migrate)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/node_modules ./node_modules

# Create uploads directory for multer file uploads
RUN mkdir -p backend/uploads

# Expose the backend port
EXPOSE 4000

# Run migrations on startup, then start the server
CMD ["sh", "-c", "cd backend && npx prisma migrate deploy && node dist/index.js"]
