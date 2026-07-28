FROM node:20-slim

# Install OpenSSL (required by Prisma engine)
RUN apt-get update -qq && apt-get install -y -qq openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything
COPY . .

# DEBUG: Show what files are in the container
RUN echo "=== ROOT DIRECTORY ===" && ls -la /app/ && \
    echo "=== Does shared/ exist? ===" && ls -la /app/shared/ 2>&1 || echo "shared/ NOT FOUND" && \
    echo "=== Does backend/ exist? ===" && ls -la /app/backend/ 2>&1 || echo "backend/ NOT FOUND"

# Build shared package independently (install deps + compile)
RUN cd /app/shared && npm install && npm run build

# Copy shared into backend/node_modules/@apartment/shared
# This lets backend find @apartment/shared locally without workspace/registry resolution
RUN mkdir -p /app/backend/node_modules/@apartment && \
    cp -r /app/shared /app/backend/node_modules/@apartment/shared

# Install backend dependencies (finds @apartment/shared via symlink, skips registry)
RUN cd /app/backend && npm install --legacy-peer-deps && npx prisma generate && npm run build

EXPOSE 4000

CMD ["sh", "-c", "cd /app/backend && npx prisma migrate deploy && node dist/index.js"]
