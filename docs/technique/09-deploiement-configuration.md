# 9. Déploiement et configuration

## Démarrage avec Docker

```bash
cp .env.example .env
# Renseigner au minimum :
#   BETTER_AUTH_SECRET   (openssl rand -base64 32)
#   WIKI_CONTACT         (URL ou email : exigé par Wikimedia)
#   PUBLIC_URL           (https://… en production)
docker compose up -d --build
```

| Service | Image | Rôle | Exposition |
| --- | --- | --- | --- |
| `db` | `postgres:17-alpine` | Base de données (volume `pgdata`) | `127.0.0.1:5432` uniquement |
| `api` | `apps/api/Dockerfile` | NestJS : applique les migrations au démarrage puis lance l'API ; photos dans le volume `media` | réseau interne |
| `web` | `apps/web/Dockerfile` | Nuxt : interface et proxy `/api` | port `WEB_PORT` (3000) |

Les deux images applicatives sont construites en deux étapes, tournent avec l'utilisateur non-root `node` et partent de `node:22-bookworm-slim`.

## Production

- Placer un **reverse proxy HTTPS** (Caddy, Traefik, Nginx) devant `web`, puis mettre `TRUST_PROXY=true` et `PUBLIC_URL=https://…`. Le HTTPS est indispensable pour l'installation de la PWA et les notifications.
- **Sauvegarder** les volumes `pgdata` (`pg_dump`) et `media` (les photos peuvent être retéléchargées, mais cela prend du temps).
- Générer les clés de notification : `npx web-push generate-vapid-keys`.
- Définir `ADMIN_TOKEN` (16 caractères ou plus) pour l'administration à distance du catalogue.

## Développement local

```bash
docker compose up -d db
cd apps/api && cp .env.example .env && npm install && npx prisma migrate deploy && npm run start:dev   # :3001
cd apps/web && npm install && npm run dev                                                           # :3000
```

En développement, le fichier `.env` de l'API est chargé automatiquement (`process.loadEnvFile`).

## Variables d'environnement

### Essentielles

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | — (**obligatoire**) | Signature des sessions |
| `PUBLIC_URL` (compose) / `BETTER_AUTH_URL` et `WEB_ORIGIN` (API) | `http://localhost:3000` | URL publique du site |
| `DATABASE_URL` | construite par compose | Connexion PostgreSQL |
| `POSTGRES_PASSWORD` | `garage` | Mot de passe de la base |
| `TRUST_PROXY` | `false` | Lire l'IP du joueur dans `X-Forwarded-For` (seulement derrière un reverse proxy de confiance) |
| `WEB_PORT`, `DB_PORT` | 3000, 5432 | Ports publiés |

### Jeu

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `BOOSTER_REGEN_MINUTES` | 30 | Délai entre deux boosters |
| `BOOSTER_MAX` | 10 | Taille de la réserve |
| `BOOSTER_START` | = `BOOSTER_MAX` | Boosters offerts à l'inscription |
| `CARDS_PER_BOOSTER` | 5 | Cartes par booster |
| `PITY_EPIC`, `PITY_LEGENDARY` | 10, 60 | Garanties |
| `GAME_TIMEZONE` | `Europe/Paris` | Fuseau des journées et des rotations |
| `STARTING_CREDITS` | 100 | Crédits de bienvenue |
| `GAMES_PER_DAY` | 3 | Parties par jour et par mini-jeu |
| `TRADE_DAYS`, `MAX_OPEN_TRADES` | 7, 10 | Bourse |
| `SHOP_SECRET` | dérivé de `BETTER_AUTH_SECRET` | Graine du programme de la boutique |

### Catalogue et médias

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `CATALOG_AUTO_IMPORT` | `wikidata` | Import au premier démarrage : `wikidata`, `seed` ou `off` |
| `CATALOG_IMPORT_LIMIT` | 3000 | Nombre maximal de voitures importées |
| `WIKI_CONTACT` | URL du dépôt | Contact transmis dans le User-Agent |
| `WIKI_USER_AGENT` | construit à partir de `WIKI_CONTACT` | User-Agent complet (remplace le précédent) |
| `WIKIMEDIA_TOKEN` | — | Jeton Wikimedia facultatif (limites de débit plus hautes) |
| `MEDIA_DIR` | `./media` (`/data/media` en Docker) | Dossier des photos |
| `MEDIA_REMOTE_FALLBACK` | `true` | Afficher l'image distante tant que la copie locale manque |
| `MEDIA_SYNC_HOURS` | 6 | Fréquence de reprise du rapatriement (0 = jamais) |

### Notifications et administration

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | — | Clés Web Push (sans elles, les notifications sont désactivées) |
| `VAPID_SUBJECT` | `mailto:contact@example.com` | Contact Web Push |
| `PUSH_CHECK_SECONDS` | 60 | Fréquence de vérification des réserves pleines |
| `ADMIN_TOKEN` | — | Jeton des routes `/api/admin/*` (16 caractères minimum) |

## Exploitation

| Besoin | Commande |
| --- | --- |
| Suivre l'API | `docker compose logs -f api` |
| État du catalogue | `docker compose exec api node dist/cli/import-catalog stats` |
| Relancer l'import | `docker compose exec api node dist/cli/import-catalog wikidata 3000` |
| Reprendre seulement les photos | `docker compose exec api node dist/cli/import-catalog media` |
| Forcer la rareté d'une carte | `UPDATE car SET "rarityOverride" = 'LEGENDARY' WHERE "externalId" = 'Q…';` |
| Retirer une carte du jeu | `UPDATE car SET active = false WHERE …;` (elle n'est plus tirée ni affichée dans le catalogue ; les exemplaires possédés restent en base et comptent toujours dans les statistiques) |

## Limites d'une instance unique

Les tâches de fond (notifications, rapatriement des médias, expiration des offres) tournent dans le processus de l'API. Avec **plusieurs instances** de l'API, les verrous et les mises à jour conditionnelles empêchent les doublons sur les données. Les tâches seraient en revanche exécutées par chaque instance. Voir [Évolutions](11-evolutions.md).
