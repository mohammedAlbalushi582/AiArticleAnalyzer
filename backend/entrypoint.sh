#!/bin/bash
set -e

echo "Waiting for PostgreSQL..."
# A real connection, not just a port probe: Postgres opens its port before it
# can accept queries ("the database system is starting up"), so a TCP check
# passes too early and migrations crash the container.
while ! python -c "import os, psycopg2; psycopg2.connect(os.environ['DATABASE_URL']).close()" 2>/dev/null; do
    sleep 1
done
echo "PostgreSQL is ready."

echo "Running migrations..."
python manage.py migrate --noinput

echo "Starting server..."
exec "$@"
