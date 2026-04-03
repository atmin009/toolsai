#!/bin/sh
set -e
# ใช้กับ MySQL ภายนอก — ไม่รอ container mysql (ดู DATABASE_URL ใน compose/.env)
echo "Applying database schema..."
npx prisma db push

echo "Starting API..."
exec node dist/index.js
