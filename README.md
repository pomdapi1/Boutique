# Conserve — espace créateurs & administration

Application de gestion de la boutique dépôt-vente **Conserve** : feed des ventes en temps réel, ventes et stocks par créateur, statistiques, documents, reversements mensuels, synchronisation avec la caisse **SumUp**.

- **Stack** : Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · Prisma + SQLite · sessions JWT signées (jose + bcrypt) · Recharts · @react-pdf/renderer
- **Maquettes** : [docs/maquettes/](docs/maquettes/)
- **Déploiement** : [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) (Coolify + GitHub)

## Fonctionnement

| Concept | Règle |
|---|---|
| Caisse | Un seul compte SumUp (celui de la boutique), configuré par variables d'environnement. |
| Attribution | Chaque ligne de vente SumUp est rattachée à un produit via son nom : `012 - Pot de fleurs (petit) - Le jardin du crochet` (ou le « nom dans la caisse SumUp » défini par l'admin). Les lignes non reconnues apparaissent dans **Admin › Ventes › Non attribuées**. |
| Stock | Géré dans l'application : décrémenté à chaque vente importée, ré-incrémenté en cas de remboursement. Les créateurs ajoutent / retirent du stock eux-mêmes. |
| Commission | Taux par créateur (30 % par défaut), **sur le CA brut**, figé au moment de la vente. |
| Net à reverser | CA brut − frais SumUp (réels, `fee_amount`, répartis au prorata des lignes) − commission Conserve. |
| Validation | Nouveau produit → « En attente » jusqu'à validation admin. Modification d'un produit actif → demande soumise à l'admin. |
| Clôture | L'admin clôture un mois (montants figés + notification aux créateurs), puis marque chaque reversement payé. |

## Tester en local (Windows / PowerShell)

Prérequis : **Node.js 22+** (testé avec Node 26).

```powershell
npm install
copy .env.example .env
# Éditez .env : remplacez AUTH_SECRET par une longue chaîne aléatoire, par ex. :
#   [Convert]::ToBase64String((1..48 | % { Get-Random -Max 256 }))
npx prisma migrate dev      # crée data/conserve.db puis lance le seed de démo
npm run dev                 # http://localhost:3000
```

`npm run seed` réinitialise la base de démo à tout moment (efface toutes les données locales).

### Comptes de démo

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur | `admin@conserve.test` | `admin123` |
| Créateur « Le jardin du crochet » | `crochet@conserve.test` | `demo123` |
| Autres créateurs | `naime@`, `sarradeuxairs@`, `baldck@`, `acre@`… `conserve.test` | `demo123` |

### Scénarios à vérifier

1. **Feed temps réel** — connecté en créateur sur *La boutique*, lancez dans un autre terminal `npm run sumup:simulate -- 3` : les ventes apparaissent sous 30 s (rafraîchissement auto), les paniers contenant vos produits sont marqués ○, *CA global* ouvre le CA par créateur.
   Variante continue : `MOCK_AUTO_SALE_SECONDS="20"` dans `.env` puis relancez `npm run dev`.
2. **Ventes** — *Mes ventes* : changez de mois, filtrez Carte / Espèces ou par produit, **Exporter en PDF**. Vérifiez : net = brut − frais SumUp − 30 %.
3. **Stock** — *Mes produits* › **Stock** sur un produit : ajoutez puis retirez (impossible de descendre sous 0). Un produit vendu jusqu'à 0 passe dans l'onglet *Rupture de stock* et déclenche une notification 🔔.
4. **Validation produits** — créateur : **Ajouter des produits** → statut « En attente » ; **Modifier** un produit actif → « Modif. en attente ». Admin : *Produits* › **Valider** / **Appliquer** → le créateur est notifié.
5. **Documents** — *Mes documents* : déposez un PDF, remplacez-le, supprimez-le. Un fichier > 2 Mo, un faux PDF (ex. `.txt` renommé) ou un 2ᵉ RIB doivent être refusés. L'admin les consulte dans *Créateurs › fiche*.
6. **Admin** — *Créateurs* : créez un compte, changez un taux de commission ; *Ventes › Non attribuées* : rattachez la ligne « Porte clef moyen crochet » ; *Reversements* : clôturez le mois précédent, marquez payé ; *Notifications* : envoyez un message à tous.
7. **Droits** — un créateur qui ouvre `/admin` est renvoyé vers son espace ; il ne peut pas télécharger le document d'un autre créateur (404).

### Tests automatisés

```powershell
npm test                      # tests unitaires (calculs, attribution, conversion SumUp)
npm run typecheck             # vérification TypeScript
npx playwright install chromium   # une seule fois
npm run e2e                   # parcours navigateur (démarre `next dev` si besoin)
```

Les tests e2e ajoutent des produits « Produit e2e … » : relancez `npm run seed` pour repartir d'une base propre.

### Tester avec le vrai SumUp

1. Dans le tableau de bord SumUp : *Développeurs › Clés API* → créez une **clé secrète** (`sk_…`). Notez votre **code marchand** (*Profil*).
2. Dans `.env` : `SUMUP_MODE="live"`, `SUMUP_API_KEY="sk_…"`, `SUMUP_MERCHANT_CODE="…"`.
3. `npm run dev`, puis *Admin › Paramètres & SumUp* › **Tester la connexion** puis **Synchroniser maintenant** (ou `npm run sumup:sync`). Ensuite la synchro tourne toute seule (`SUMUP_SYNC_INTERVAL_SECONDS`).
4. Nommez les articles de la caisse SumUp au format `NNN - Nom - Créateur` (le nom attendu est affiché lors de la validation d'un produit).

> La première synchro importe les `SUMUP_INITIAL_DAYS` derniers jours. Une base de démo contient des ventes fictives : pour un test réel, partez d'une base vide (`npx prisma migrate reset --skip-seed`) et créez les créateurs / produits correspondant à votre caisse.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et serveur de production |
| `npm run seed` | base de démo (efface tout) |
| `npm run sumup:simulate -- N` | injecte N ventes simulées |
| `npm run sumup:sync` | synchro SumUp ponctuelle (mode live) |
| `npm test` / `npm run e2e` | tests |

## Arborescence

```
prisma/            schéma, migrations, seed
src/app/creator/   espace créateur (boutique, ventes, produits, stats, documents)
src/app/admin/     espace administrateur
src/app/actions/   server actions (formulaires)
src/app/api/       export PDF, téléchargement de documents
src/lib/           logique métier (ventes, attribution, stats, SumUp, auth…)
src/components/    composants d'interface
tests/             tests unitaires (Vitest) et e2e (Playwright)
```
