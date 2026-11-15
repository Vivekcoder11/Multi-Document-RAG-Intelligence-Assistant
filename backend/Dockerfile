# Multi-stage production build for FastAPI Backend
FROM python:3.11-slim as builder

WORKDIR /app

# Install system dependencies needed for compiling Python libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final Stage
FROM python:3.11-slim

WORKDIR /app

# Runtime dependencies (libgomp for numpy/chroma, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy backend application code
COPY . /app

# Create storage and persistent data directories
RUN mkdir -p /app/data /app/uploads /app/data/chroma

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

