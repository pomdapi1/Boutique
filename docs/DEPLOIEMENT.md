# Déploiement — VPS + Coolify + GitHub

Chaque push sur `main` déclenche automatiquement un nouveau déploiement. La CI GitHub Actions (`.github/workflows/ci.yml`) vérifie types, tests unitaires, build et parcours e2e sur chaque Pull Request.

## 1. Serveur

- VPS Linux en Europe, 2 vCPU / 4 Go RAM suffisent (Hetzner CX22, OVH VPS, Scaleway…).
- Un nom de domaine pointant vers l'IP du serveur, ex. `app.votre-domaine.fr` (enregistrement DNS **A**).
- Installer Coolify (en root) :
  ```bash
  curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
  ```
  Puis ouvrir `http://<ip>:8000`, créer le compte administrateur Coolify.

## 2. Connecter GitHub

Coolify › *Sources* › **GitHub App** → installer l'application sur le dépôt `pomdapi1/Boutique` (accès au dépôt privé + webhooks de déploiement automatique).

## 3. Créer l'application

Coolify › *Projects* › *New resource* › **Private repository (GitHub App)** :

| Réglage | Valeur |
|---|---|
| Branche | `main` |
| Build pack | **Dockerfile** |
| Port exposé | `3000` |
| Domaine | `https://app.votre-domaine.fr` (certificat HTTPS automatique) |
| Auto deploy | activé |

### Stockage persistant (indispensable)

*Storages* › **Add volume** : chemin de destination `/app/data`.
La base SQLite (`/app/data/boutique.db`) et les documents des créateurs (`/app/data/uploads`) y sont conservés entre deux déploiements.

### Variables d'environnement

| Variable | Valeur |
|---|---|
| `AUTH_SECRET` | chaîne aléatoire ≥ 32 caractères (`openssl rand -base64 48`) |
| `ADMIN_EMAIL` | email du premier compte admin |
| `ADMIN_PASSWORD` | mot de passe initial (≥ 10 caractères) — créé au 1er démarrage, à retirer ensuite |
| `ADMIN_RESET_PASSWORD` | `true` uniquement pour réinitialiser le mot de passe de `ADMIN_EMAIL` avec `ADMIN_PASSWORD` au prochain démarrage — à retirer ensuite |
| `CONTACT_EMAIL` | email affiché sur la page de connexion (« mot de passe oublié ») |
| `SUMUP_MODE` | `live` |
| `SUMUP_API_KEY` | clé secrète SumUp `sk_…` (cocher *secret*) |
| `SUMUP_MERCHANT_CODE` | code marchand SumUp |
| `SUMUP_SYNC_INTERVAL_SECONDS` | `60` |
| `SUMUP_INITIAL_DAYS` | `30` (profondeur du premier import) |

`DATABASE_URL`, `UPLOAD_DIR`, `TZ` sont déjà définis dans le Dockerfile.

## 4. Premier déploiement

**Deploy** → les migrations Prisma s'appliquent au démarrage du conteneur (`docker-entrypoint.sh`), puis le compte admin est créé.
Connectez-vous, puis : *Paramètres & SumUp* › **Tester la connexion** → créez les créateurs (*Créateurs* › Ajouter) et leurs produits.

## 5. Sauvegardes

Coolify › *Scheduled tasks* sur l'application, par ex. chaque nuit :
```bash
sqlite3 /app/data/boutique.db ".backup '/app/data/backup-$(date +%F).db'"
```
et/ou une sauvegarde du volume `/app/data` vers un stockage S3 externe (Coolify › *S3 storages*). Pensez à garder une copie hors du serveur.

## Flux de travail Git

```
branche de travail ─▶ Pull Request ─▶ CI verte ─▶ merge dans main ─▶ déploiement Coolify
```

Retour arrière : Coolify › *Deployments* › redéployer une version précédente (les migrations étant additives, préférez un correctif plutôt qu'un rollback de schéma).

## Passer à PostgreSQL (optionnel)

SQLite suffit largement pour une boutique (quelques milliers de ventes / mois, un seul serveur). Si besoin plus tard : `provider = "postgresql"` dans `prisma/schema.prisma`, base PostgreSQL créée dans Coolify, `DATABASE_URL` mise à jour, nouvelle migration initiale.
