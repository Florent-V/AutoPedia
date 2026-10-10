# Garage 🏎️

Jeu de collection de cartes sur le thème de l'automobile, inspiré de Wiki-Masters et TCGeo.
Chaque carte est un vrai modèle de voiture, avec ses données issues de **Wikidata** et son résumé tiré de **Wikipédia**.

- Un booster se recharge toutes les **30 minutes**, avec **10 boosters** maximum en réserve.
- Un booster contient **5 cartes**. La dernière carte est toujours au moins *Peu commune*.
- Il y a **5 raretés**, qui valent plus ou moins de points. Les cartes *Épique* et *Légendaire* sont holographiques.
- On peut parcourir sa collection avec des filtres et voir le détail de chaque carte (fiche technique, résumé Wikipédia).
- Il y a **24 succès / badges** (boosters, collection, rareté, exploration, score).
- C'est une **application mobile installable (PWA)** : barre d'onglets, révélation des cartes une par une au toucher ou par glissement, vibrations sur les cartes rares (Android), et notification quand la réserve de boosters est pleine.

## Stack

| Couche | Techno |
| --- | --- |
| Front | Nuxt 4 (Vue 3), SPA servie par Nitro, qui fait aussi proxy `/api` → API |
| Back | NestJS 11, Prisma 6 |
| Base | PostgreSQL 17 |
| Auth | Better Auth (email + mot de passe, sessions par cookie httpOnly, rate limiting) |
| Infra | Docker Compose (`db`, `api`, `web`) |

```
apps/
  api/   NestJS : auth, boosters, collection, succès, import du catalogue
  web/   Nuxt   : pages, design des cartes et des boosters, animations
docker-compose.yml
```

## Démarrage rapide (Docker)

```bash
cp .env.example .env
# renseigner BETTER_AUTH_SECRET (ex. : openssl rand -base64 32)
docker compose up -d --build
```

Ouvrir ensuite http://localhost:3000.

Au premier démarrage, l'API importe automatiquement le catalogue en arrière-plan, en deux temps :

1. **Les données** des voitures depuis Wikidata. Le jeu est jouable dès que cette étape est finie.
2. **Les photos et les résumés** depuis Wikimedia Commons et Wikipédia, téléchargés et stockés chez toi. Pour 3 000 voitures, compte de quelques dizaines de minutes à quelques heures selon la tolérance des serveurs Wikimedia. En attendant, les cartes affichent l'image distante ou le dessin technique.

Pense à renseigner `WIKI_CONTACT` dans `.env` (une URL ou une adresse e-mail) : Wikimedia demande de pouvoir identifier les programmes qui l'interrogent.

Si Wikidata est injoignable, un **jeu de secours** d'environ 115 voitures emblématiques est chargé à la place, pour que le jeu reste jouable.

Pour suivre l'avancement : `docker compose logs -f api`, ou `docker compose exec api node dist/cli/import-catalog stats`.

## Développement local

```bash
docker compose up -d db                  # PostgreSQL seul

cd apps/api
cp .env.example .env
npm install
npx prisma migrate deploy
npm run start:dev                        # http://localhost:3001

cd ../web
npm install
npm run dev                              # http://localhost:3000 (proxy /api → :3001)
```

Commandes utiles côté API :

```bash
npm test                                  # tests unitaires
npm run build && npm run catalog:import   # import Wikidata + photos + résumés (repli sur le jeu de secours)
node dist/cli/import-catalog seed         # forcer le jeu de secours
node dist/cli/import-catalog wikidata 5000
node dist/cli/import-catalog media        # reprendre seulement les photos et résumés manquants
node dist/cli/import-catalog stats        # état : cartes, photos locales, photos en attente, résumés
```

## Règles du jeu

### Régénération des boosters

Le calcul est « paresseux » : on ne fait tourner aucun cron. Pour chaque joueur, la base stocke le nombre de boosters et une ancre de temps (`player.boosters`, `player.boosterAnchor`). À chaque lecture, on ajoute `floor((maintenant − ancre) / intervalle)` boosters, plafonnés au maximum. Quand la réserve est pleine, le minuteur s'arrête, et il repart dès qu'on ouvre un booster (voir `apps/api/src/game/booster-clock.ts`, couvert par des tests).

L'ouverture se fait dans une transaction avec un verrou `SELECT … FOR UPDATE` sur la ligne du joueur. Deux clics simultanés ne peuvent donc pas consommer le même booster.

### Raretés

La rareté vient de la **notoriété** du modèle : le nombre de Wikipédias qui ont un article sur ce modèle (`sitelinks` Wikidata). Le catalogue est trié par notoriété puis découpé ainsi :

| Rareté | Part du catalogue | Points | Tirage normal | Carte vedette (5ᵉ) |
| --- | --- | --- | --- | --- |
| Commune | 50 % | 1 | 62 % | — |
| Peu commune | 27 % | 3 | 26 % | 55 % |
| Rare | 15 % | 10 | 9 % | 33 % |
| Épique ✨ | 6 % | 30 | 2,5 % | 9,5 % |
| Légendaire ✨ | 2 % | 100 | 0,5 % | 2,5 % |

Tous ces réglages se trouvent dans `apps/api/src/game/rarity.ts`. On peut forcer la rareté d'une carte avec la colonne `car.rarityOverride` : les imports ne l'écrasent jamais.

Le **score de collection** est la somme des points des cartes différentes possédées. Les doublons sont comptés (`user_card.quantity`), ce qui préparera les échanges.

### Succès

Ils sont définis de façon déclarative dans `apps/api/src/achievements/achievements.definitions.ts`. Chaque succès associe une statistique (boosters ouverts, cartes uniques, légendaires, cartes d'un même constructeur, pays, décennies, points…) à un objectif. Pour en ajouter un, il suffit d'ajouter une ligne. Les succès sont évalués à chaque ouverture et notifiés côté front.

## Application mobile (PWA)

- **Installation :** sur Android et sur ordinateur (Chrome, Edge), un bouton « Installer » apparaît sur la page Boosters et dans le Profil. Sur iPhone, il faut passer par Safari : **Partager** puis **Sur l'écran d'accueil**. Le jeu s'ouvre alors en plein écran, comme une application.
- **Hors-ligne :** un service worker (`apps/web/public/sw.js`) met en cache l'interface et les photos déjà vues (600 au maximum). Le reste de l'API n'est jamais mis en cache, pour que l'état du jeu reste toujours à jour.
- **Notifications :** quand la réserve d'un joueur abonné atteint son maximum, l'API lui envoie **une seule** notification Web Push, puis attend qu'il ouvre un booster avant de pouvoir le prévenir à nouveau. Le joueur les active dans **Profil > Application**. Sur iPhone, les notifications ne marchent que si l'application est installée (iOS 16.4 ou plus).
  - Générer les clés avec `npx web-push generate-vapid-keys`, puis renseigner `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` dans `.env`. Sans ces clés, les notifications sont simplement désactivées.
  - Le serveur vérifie les réserves toutes les 60 secondes (`PUSH_CHECK_SECONDS`).
- **HTTPS :** l'installation et les notifications exigent que le site soit servi en HTTPS (sauf sur `localhost`).
- **App Store / Play Store :** la même base pourra être enveloppée avec Capacitor, sans réécrire le front.

## Source des données

Tout est rapatrié chez toi : les données et les résumés en base PostgreSQL, les photos dans un dossier local (le volume Docker `media`).

- **Wikidata** (licence CC0) fournit la liste des voitures, avec la marque (à défaut, le constructeur), le pays, les années de production, la puissance, la vitesse maximale, la masse, la longueur, la photo de référence et les titres Wikipédia fr/en. Ces caractéristiques sont inégalement renseignées dans Wikidata : chaque carte affiche les trois premières disponibles. On prend deux familles :
  - les **voitures de série**, classées « modèle d'automobile » (`Q3231690`) ;
  - les **voitures de course** (F1, endurance, rallye…), classées « modèle d'automobile de course » (`Q90834785`). Ce n'est pas une sous-classe de la précédente dans Wikidata. Elles portent un drapeau 🏁 et ont leurs propres succès.

  L'import récupère d'abord la liste de chaque famille (requête légère, triée côté application par notoriété), puis les détails par lots de 50. Voir `apps/api/src/catalog/wikidata.ts`.
- **Photos** (Wikimedia Commons) : l'API Commons, interrogée par lots de 50, donne pour chaque photo une miniature, l'**auteur** et la **licence**. La miniature est convertie en WebP de 640 px de large (environ 50 à 80 Ko), stockée dans `MEDIA_DIR`, puis servie par l'API sous `/api/media/…` avec un cache long. L'application la garde aussi hors-ligne. Les crédits (auteur, licence, lien vers la source) s'affichent dans la fiche de chaque carte, comme l'exigent les licences CC BY-SA.
- **Résumés** (Wikipédia) : l'introduction de l'article est récupérée par lots de 20 pendant l'import et stockée en base.
- **Politesse et reprise** : un User-Agent avec contact, un espacement minimal entre les requêtes vers un même domaine, et le respect des en-têtes `Retry-After` en cas de limitation (429). Un blocage temporaire interrompt proprement le rapatriement, qui reprend au démarrage suivant, toutes les 6 heures (`MEDIA_SYNC_HOURS`), ou avec `import-catalog media`. Une photo introuvable n'est retentée qu'au bout de 7 jours. Le jeton facultatif `WIKIMEDIA_TOKEN` peut relever les limites de débit.
- **Repli** : tant qu'une photo n'est pas téléchargée, la carte affiche l'image distante (`MEDIA_REMOTE_FALLBACK=true`) ou, à défaut, le dessin technique.

Pour relancer l'import en production : `POST /api/admin/catalog/import` avec l'en-tête `x-admin-token: $ADMIN_TOKEN` et le corps `{"source":"wikidata","limit":3000}`. Avec `{"source":"media"}`, seuls les photos et résumés manquants sont repris. `GET /api/admin/catalog/status`, avec le même en-tête, donne l'état du catalogue.

## API

Toutes les routes sont préfixées par `/api` et demandent une session, sauf indication contraire.

| Méthode | Route | Rôle |
| --- | --- | --- |
| * | `/auth/*` | Better Auth (`sign-up/email`, `sign-in/email`, `sign-out`, `get-session`…) |
| GET | `/me` | Profil, état des boosters, statistiques |
| GET | `/boosters` | État de la réserve (disponibles, prochain booster) |
| POST | `/boosters/open` | Ouvre un booster et renvoie les cartes, l'état et les nouveaux succès |
| GET | `/collection` | Catalogue paginé avec possession (`search`, `rarity`, `manufacturer`, `owned`, `sort`, `page`) |
| GET | `/collection/summary` | Progression par rareté et par constructeur |
| GET | `/cars/:id` | Détail d'une carte, avec le résumé Wikipédia |
| GET | `/achievements` | Succès avec progression |
| GET | `/push/public-key` | Public : clé VAPID (ou `null` si les notifications sont désactivées) |
| POST | `/push/subscribe` · `/push/unsubscribe` · `/push/test` | Gestion des notifications de l'appareil |
| GET | `/health` | Public : état de l'API et taille du catalogue |

## Sécurité

- Les mots de passe sont hachés par Better Auth (scrypt). Les sessions sont stockées en base, dans des cookies httpOnly, avec l'attribut `Secure` automatiquement activé en HTTPS.
- Rate limiting : 10 tentatives de connexion et 5 inscriptions par minute et par IP. Le proxy Nuxt transmet l'IP du joueur à l'API. Si un reverse proxy (Caddy, Traefik, Nginx…) est placé devant le site, mettre `TRUST_PROXY=true` pour que l'IP d'origine soit lue dans `X-Forwarded-For`. Sans reverse proxy, laisser `false`, sinon un joueur pourrait falsifier son IP.
- Le front et l'API partagent la même origine grâce au proxy Nitro, donc pas de cookies tiers. `trustedOrigins` protège contre le CSRF.
- Toutes les routes métier passent par un guard global. La validation des entrées se fait avec `class-validator`.

## Pistes pour la suite (multijoueur)

Le schéma est déjà prêt pour les échanges : les cartes possédées sont des lignes `(userId, carId, quantity)`. Il suffira d'ajouter :

- `Friendship (requesterId, addresseeId, status)` pour les demandes d'amis ;
- `TradeOffer (fromId, toId, status, createdAt)` et `TradeItem (offerId, carId, quantity, direction)` pour les échanges ;
- un service `trade.accept()` qui, dans une transaction avec verrous sur les deux joueurs, vérifie les quantités, déplace les exemplaires et réévalue les succès des deux côtés.

Autres idées : boosters thématiques (par pays ou par décennie), défis quotidiens, classement par points, page publique de collection, connexion OAuth (Google, GitHub) via les plugins Better Auth.
