# --- Build -------------------------------------------------------------
FROM node:26-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

# CLI Prisma autonome (avec toutes ses dépendances : effect, c12…) pour
# appliquer les migrations au démarrage. Même version que celle du projet.
RUN PRISMA_VERSION=$(node -p "require('./node_modules/prisma/package.json').version") \
 && mkdir -p /prisma-cli && cd /prisma-cli && echo '{"private":true}' > package.json \
 && npm install --omit=dev --no-audit --no-fund --no-package-lock "prisma@${PRISMA_VERSION}" \
 && node node_modules/prisma/build/index.js --version

# --- Dépendances de production complètes --------------------------------
# Le traçage du build "standalone" de Next.js oublie certains fichiers chargés
# dynamiquement (polices de pdfkit, fichiers "module-sync" comme
# generator-function/require.mjs sous Node 22).
# On embarque donc toutes les dépendances de production.
FROM node:26-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# --- Runtime -----------------------------------------------------------
FROM node:26-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tzdata curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Europe/Paris \
    DATABASE_URL=file:/app/data/boutique.db \
    UPLOAD_DIR=/app/data/uploads

RUN groupadd --system app && useradd --system --gid app --home /app app

# 1) dépendances de production complètes, 2) serveur standalone par-dessus
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/prisma ./prisma
# Client Prisma généré (moteur de requêtes) utilisé par l'application
COPY --from=builder --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=app:app /app/node_modules/@prisma/client ./node_modules/@prisma/client
# CLI Prisma (migrations), installé à part pour ne pas mélanger ses dépendances
COPY --from=builder --chown=app:app /prisma-cli /app/prisma-cli
COPY --chown=app:app docker-entrypoint.sh ./

RUN mkdir -p /app/data/uploads && chown -R app:app /app/data && chmod +x docker-entrypoint.sh
USER app

# Base SQLite + documents : à monter comme volume persistant dans Coolify
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD curl -fsS -o /dev/null http://127.0.0.1:3000/login || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
