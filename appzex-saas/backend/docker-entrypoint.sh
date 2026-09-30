#!/bin/sh
set -e

# Apply pending migrations (non-destructive, safe for production).
npx prisma migrate deploy

# Demo deployments: load the seed only when the database is still empty.
if [ "$SEED_ON_START" = "true" ]; then
  SEED_ONLY_IF_EMPTY=true npx tsx prisma/seed.ts
fi

exec node dist/server.js
