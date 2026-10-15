# 1. Architecture et choix techniques

## Vue d'ensemble

```
 Navigateur / PWA installée
 (Nuxt 4 en mode SPA + service worker)
        │  HTTPS, même origine
        ▼
 ┌──────────────────────┐      /api/**  (proxy)     ┌──────────────────────────┐
 │ web : Nuxt / Nitro   │ ─────────────────────────►│ api : NestJS 11          │
 │ sert l'app + proxy   │                           │ Better Auth, Prisma 6    │
 └──────────────────────┘                           │ tâches de fond :         │
                                                    │  · import catalogue      │
                                                    │  · rapatriement médias   │
                                                    │  · notifications push    │
                                                    │  · expiration des offres │
                                                    └───────┬─────────┬────────┘
                                                            │         │
                                                  PostgreSQL 17    volume « media »
                                                            ▲      (photos WebP)
                                                            │
                         Wikidata · Wikimedia Commons · Wikipédia (import)
```

Trois conteneurs Docker : `db` (PostgreSQL), `api` (NestJS) et `web` (Nuxt). Seul `web` est exposé.

## Organisation du dépôt

```
apps/
  api/                       NestJS
    prisma/                  schéma + migrations
    src/
      auth/                  Better Auth, garde global, décorateurs
      player/                état joueur, statistiques
      game/                  logique pure : horloge, raretés, aléatoire déterministe, fuseau
      boosters/              ouverture des boosters
      collection/ cars/      consultation du catalogue
      achievements/          définitions et évaluation des succès
      economy/               portefeuille (crédits, cartes, verrous)
      games/                 mini-jeux
      shop/                  boutique (rotation + achat)
      trades/                bourse d'échanges
      push/                  Web Push
      catalog/               import Wikidata, médias, client HTTP poli
      cli/                   commande d'import
  web/                       Nuxt 4
    app/pages/               écrans
    app/components/          cartes, boosters, marché…
    app/composables/         API, session, joueur, PWA, notifications
    server/routes/api/       proxy vers l'API
    public/                  manifeste, service worker, icônes
docs/                        cette documentation
docker-compose.yml
```

## Choix techniques et justifications

| Choix | Pourquoi | Alternatives écartées |
| --- | --- | --- |
| **NestJS 11** | Demandé ; structure modulaire claire, injection de dépendances, validation intégrée | NestJS 12, plus récent mais encore moins éprouvé au moment du développement |
| **Prisma 6** | Schéma lisible, migrations versionnées, types générés, adaptateur officiel Better Auth | Prisma 7/8 (nouveau générateur, adaptateurs obligatoires), Drizzle |
| **PostgreSQL** | Demandé ; transactions et verrous de ligne (`FOR UPDATE`) indispensables pour l'économie | — |
| **Better Auth** | Bibliothèque prête à l'emploi : sessions en base, hachage des mots de passe, limitation de débit, plugins OAuth et 2FA pour plus tard | Passport + JWT maison (plus de code sensible à écrire), service externe (dépendance et coût) |
| **Nuxt 4, mode SPA** | Demandé (Vue + Nuxt) ; jeu derrière une connexion, donc le référencement n'est pas un enjeu, et le rendu serveur n'apporterait que de la complexité | Rendu serveur (SSR), qui obligerait à transmettre la session côté serveur |
| **Proxy `/api` dans Nitro** | Une seule origine : cookies first-party, pas de CORS, pas de problème de cookies tiers sur Safari | API exposée sur un autre domaine |
| **PWA plutôt qu'appli native** | Une seule base de code, installation sans store, notifications push ; enveloppable plus tard avec Capacitor | React Native ou Flutter (deuxième base de code) |
| **CSS fait main** | Les cartes demandent un CSS spécifique (holographie, `container queries`, 3D) ; pas de framework à apprendre | Tailwind |
| **Logique de jeu en fonctions pures** (`src/game/`) | Testable sans base de données ; règles lisibles en un seul endroit | Logique dispersée dans les services |
| **Tâches de fond par `setInterval`** dans l'API | Suffisant pour une instance unique ; aucune infrastructure en plus | File de tâches (BullMQ et Redis) : à prévoir pour plusieurs instances, voir [Évolutions](11-evolutions.md) |
| **Photos stockées localement en WebP** | Indépendance vis-à-vis de Wikimedia, performances, hors-ligne, respect de leur politique robots | Liens directs vers Wikimedia (fragile, et soumis à leurs limites) |

## Flux d'une requête

1. Le navigateur appelle `/api/boosters/open` sur l'origine du site.
2. Nitro (conteneur `web`) **proxifie** la requête vers `http://api:3001/api/boosters/open`. Il transmet les cookies et ajoute `X-Forwarded-For` (l'IP du joueur, pour la limitation de débit).
3. Dans NestJS, le **garde global** `AuthGuard` valide la session Better Auth (cookie signé, cache court) et place l'utilisateur dans la requête.
4. Le **contrôleur** valide les entrées (`class-validator`) puis appelle le **service**.
5. Le service ouvre une **transaction** Prisma, **verrouille** les lignes concernées (`SELECT … FOR UPDATE`), applique les règles (fonctions pures de `src/game/`), écrit, évalue les succès et répond.

Les routes `/api/auth/*` sont traitées directement par le gestionnaire Better Auth, monté avant l'analyse du corps JSON. Les photos `/api/media/*` sont servies en fichiers statiques avec un cache d'un an.

## Fuseau horaire

Les journées de jeu (parties de mini-jeux, programme de la boutique) suivent `GAME_TIMEZONE` (par défaut `Europe/Paris`). Ce calcul se fait sans bibliothèque, avec l'API `Intl`, et gère les changements d'heure (`src/game/zoned-time.ts`, testé).
