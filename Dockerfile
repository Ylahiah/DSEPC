# Stage 1: Build the React frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# We pass the VITE_API_BASE_URL to point to the same host (since it will be served by FastAPI)
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

# Stage 2: Build the FastAPI backend
FROM python:3.12-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Hugging Face sets HOME to a specific dir, let's use it or stick to /app
ENV PYTHONPATH=/app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure the /data directory exists and is writable for Hugging Face persistent storage
RUN mkdir -p /data/storage/excel_exercises /data/storage/excel_submissions \
    && chmod -R 777 /data

# Hugging Face Spaces expose port 7860
EXPOSE 7860

# We set environment variables to use /data as the storage for the persistent database and files
ENV DATABASE_URL=sqlite:////data/dsepc.db
# These env variables will override the config.py paths if we update config.py to read them.
ENV EXCEL_EXERCISE_STORAGE_DIR=/data/storage/excel_exercises
ENV EXCEL_SUBMISSION_STORAGE_DIR=/data/storage/excel_submissions

# Default command
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
