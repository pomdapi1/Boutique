#!/bin/sh
set -e

echo "[entrypoint] application des migrations…"
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma

echo "[entrypoint] démarrage de Conserve"
exec node server.js
