FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build Next.js application
# BACKEND_URL is baked into the route manifest at build time (Next.js rewrites)
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=${BACKEND_URL}
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
