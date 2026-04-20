# Use Python 3.12 slim image as base
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies required for some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY docs_to_import/ ./docs_to_import/

# Create necessary directories for storage
RUN mkdir -p storage/vectorstore \
    storage/synth \
    storage/accuracy \
    storage/gold \
    storage/metrics \
    uploads \
    initial_vectorstore

# Pre-build the RAG document index so cold starts don't need to re-parse PDFs.
# The resulting documents.json is baked into the image at /app/initial_vectorstore/
# and is used by SimpleRAG when the persistent-disk copy doesn't exist yet.
RUN cd /app/src && \
    VECTOR_STORE_PATH=/app/initial_vectorstore python -c "\
import os, sys; \
sys.path.insert(0, '.'); \
from rag.simple_rag import SimpleRAG; \
from rag.config_simple import RAGConfig; \
config = RAGConfig.from_env(); \
rag = SimpleRAG(config); \
print('[Docker build] Pre-built index:', len(rag.documents), 'documents'); \
"

# Create and switch to non-root user
RUN useradd -m -u 1000 -s /bin/bash appuser \
    && chown -R appuser:appuser /app

USER appuser

# Expose port 5000
EXPOSE 5000

# Set working directory to src for proper imports
WORKDIR /app/src

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/', timeout=5)"

# Run the application with gunicorn.
# --preload  : load the app in the master process before forking workers so
#              that heavy initialisation (RAG document loading) only runs once.
# --workers 2: two workers keep memory inside the Render starter-plan limit
#              (512 MB) while still allowing some request concurrency.
# --timeout 300: large CSV uploads need more than the 120s default.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "300", "--preload", "--access-logfile", "-", "--error-logfile", "-", "api:app"]
