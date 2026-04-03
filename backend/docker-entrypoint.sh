#!/bin/sh
set -e

host="${MYSQL_HOST:-mysql}"
echo "Waiting for MySQL at ${host}:3306..."
i=0
while ! nc -z "$host" 3306; do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "Timeout waiting for MySQL"
    exit 1
  fi
  sleep 1
done

echo "MySQL is ready. Applying schema..."
npx prisma db push

echo "Starting API..."
exec node dist/index.js
