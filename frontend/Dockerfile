FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build Next.js application
# Use --webpack to force webpack instead of turbopack (required for standalone output)
RUN npx next build --webpack

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy standalone server (Next.js puts it in .next/standalone/)
COPY --from=builder /app/.next/standalone ./

# Copy static assets
COPY --from=builder /app/.next/static ./.next/static

# Copy or create public directory
RUN mkdir -p ./public

# Expose port
EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# The standalone output puts server.js at the root of the app structure
CMD ["node", "server.js"]
