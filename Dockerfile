FROM node:20-alpine
WORKDIR /app

# Copy everything
COPY . .

# Install all workspace dependencies
RUN npm install

# Build shared package first (backend depends on it)
RUN npm run build -w @apartment/shared

# Generate Prisma client
RUN cd backend && npx prisma generate

# Build backend
RUN npm run build -w @apartment/backend

EXPOSE 4000

# Run migrations on startup, then start the server
CMD ["sh", "-c", "cd backend && npx prisma migrate deploy && node dist/index.js"]
