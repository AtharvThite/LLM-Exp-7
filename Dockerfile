# -------------------------------------------------------------------
# Stage 1: Build the React Frontend
# -------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# Blank API URL means requests use relative paths (/api/ask, /api/health)
ENV VITE_API_URL=""
RUN npm run build

# -------------------------------------------------------------------
# Stage 2: Python Backend with Pre-cached Sentence Transformers
# -------------------------------------------------------------------
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

WORKDIR /app

# Install system dependencies (curl for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU-only to keep the image lightweight (saves ~2GB)
RUN pip install --no-cache-dir --default-timeout=1000 --retries 5 torch --index-url https://download.pytorch.org/whl/cpu

# Install backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --default-timeout=1000 --retries 5 -r requirements.txt

# Copy backend application code & dataset
COPY backend/app.py backend/support_rag.py backend/support_faq.txt ./

# Pre-cache the embedding model weights into the Docker image
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Copy built frontend assets into static/
COPY --from=frontend-builder /app/frontend/dist ./static

EXPOSE 8080

# Cloud Run injects PORT (default 8080)
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}
