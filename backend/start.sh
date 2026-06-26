#!/bin/sh

# Run Alembic migrations
echo "Running database migrations..."
alembic upgrade head

# Start FastAPI server
echo "Starting FastAPI server..."
PORT=${PORT:-8000}
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers
