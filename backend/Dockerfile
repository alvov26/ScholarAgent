FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies
RUN uv pip install --system --no-cache -r pyproject.toml

# Copy application code
COPY backend/ ./backend/

# Production stage
FROM python:3.12-slim-bookworm

WORKDIR /app

# Copy docker CLI binary (needed to invoke latexml/ar5ivist via the host socket)
COPY --from=docker:27-cli /usr/local/bin/docker /usr/local/bin/docker

# Copy installed dependencies from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY backend/ ./backend/
COPY backend/alembic/ ./backend/alembic/
COPY backend/alembic.ini ./backend/

# Create storage directory for compiled papers
RUN mkdir -p /app/storage

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5)" || exit 1

# Run migrations and start server
CMD alembic -c backend/alembic.ini upgrade head && \
    uvicorn backend.app.api.main:app --host 0.0.0.0 --port 8000
