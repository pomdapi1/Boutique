#!/bin/sh
set -e

echo "[entrypoint] application des migrations…"
node /app/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma

echo "[entrypoint] démarrage de Les Songes Créatifs"
exec node server.js
