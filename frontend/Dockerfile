FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build Next.js application
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy standalone server output
COPY --from=builder /app/.next/standalone/ ./

# Copy static assets to the correct location
COPY --from=builder /app/.next/static ./.next/static

# Copy or create public directory
RUN mkdir -p ./public

# Expose port
EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# server.js is at the root of the standalone output
CMD ["node", "server.js"]
