# 7. Référence de l'API

Toutes les routes sont préfixées par `/api`. Elles demandent une **session** (cookie Better Auth), sauf celles marquées « public ». Les erreurs suivent le format NestJS `{ statusCode, message, error }`, avec des messages en français prêts à afficher.

Codes courants : `400` entrée invalide · `401` non connecté · `403` interdit · `404` introuvable · `409` conflit de règle (plus de booster, crédits insuffisants, offre déjà prise…) · `503` catalogue vide.

## Authentification (Better Auth)

| Méthode | Route | Rôle |
| --- | --- | --- |
| POST | `/auth/sign-up/email` | `{ name, email, password }` : inscription et connexion |
| POST | `/auth/sign-in/email` | `{ email, password }` : connexion |
| POST | `/auth/sign-out` | Déconnexion |
| GET | `/auth/get-session` | Session courante |

## Joueur

| Méthode | Route | Réponse |
| --- | --- | --- |
| GET | `/me` | `user`, `boosters { available, max, regenMs, nextAt, serverTime }`, `stats` (points, raretés, crédits, compteurs, taille du catalogue…), `pity { epicIn, legendaryIn }` |
| GET | `/wallet` | `balance`, `earned`, `history[30]` (`label`, `amount`, `balance`, `createdAt`) |
| GET | `/achievements` | `unlocked`, `total`, `achievements[]` avec `progress` et `unlockedAt` |

## Boosters

| Méthode | Route | Réponse |
| --- | --- | --- |
| GET | `/boosters` | État de la réserve |
| POST | `/boosters/open` | `cards[]` (avec `isNew` et `quantity`), `boosters`, `stats`, `newAchievements[]`, `pity { epic, legendary }`. `409` si la réserve est vide |

## Catalogue et collection

| Méthode | Route | Paramètres / réponse |
| --- | --- | --- |
| GET | `/collection` | `search`, `rarity`, `manufacturer`, `category` (`racing`/`road`), `owned` (`all`/`owned`/`missing`), `sort` (`rarity`/`name`/`year`/`recent`), `page`, `pageSize` (100 max) → `{ items, page, pages, total }` |
| GET | `/collection/summary` | Progression par rareté et par constructeur |
| GET | `/cars/:id` | Carte complète : `summary`, `imageCredit { author, license, licenseUrl, sourceUrl }`, `quantity` |
| GET | `/media/cars/<fichier>.webp` | Public : photo (cache d'un an, immuable) |

Format d'une carte : `id, name, manufacturer, country, yearStart, yearEnd, imageUrl, racing, rarity, points, powerHp, topSpeedKmh, massKg, lengthMm, wikiUrl`.

## Mini-jeux

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/games` | `resetsAt`, `games[]` (`type`, `name`, `description`, `rounds`, `creditsPerWin`, `playsPerDay`, `playsLeft`, `active`, `bestScore`) |
| POST | `/games/:type/start` | `type` = `DUEL` ou `QUIZ`. Renvoie la partie (reprise de la partie active s'il y en a une). `409` si plus de partie aujourd'hui |
| GET | `/games/sessions/:id` | Partie : `round`, `total`, `score`, `credits`, `history[]`, `question` (sans la réponse) |
| POST | `/games/sessions/:id/answer` | `{ choice }` (`'a'`/`'b'` ou `0..3`) → `correct`, `answer`, `reveal`, `gained`, `balance`, `session`, `summary` (à la fin : `score`, `credits`, `rewardCard`, `newAchievements`) |

## Boutique

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/shop` | `date`, `hour`, `balance`, `nextRotationAt`, `rules`, `offers[]` (`offerKey`, `price`, `basePrice`, `deal`, `endsAt`, `purchased`, `card`) |
| POST | `/shop/buy` | `{ offerKey }` → `card`, `balance`, `newAchievements`. `404` si l'offre n'est plus en vente, `409` si déjà achetée ou crédits insuffisants |

## Bourse d'échanges

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/trades` | `tab` (`all`/`forme`/`mine`), `search`, `rarity`, `page` → `offers[]` (`offered`, `wanted` ou `price`, `seller`, `expiresAt`, `mine`, `canAccept`), `balance`, `openLimit` |
| POST | `/trades` | `{ offeredCarId, wantedCarId }` ou `{ offeredCarId, price }` → `{ id }` (la carte part en séquestre) |
| POST | `/trades/:id/accept` | → `card`, `balance`, `newAchievements`, `tradeId` |
| POST | `/trades/:id/cancel` | Vendeur uniquement ; la carte est rendue |

## Notifications push

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/push/public-key` | Public : clé VAPID, ou `null` si désactivé |
| POST | `/push/subscribe` | Abonnement du navigateur (`endpoint`, `keys`) |
| POST | `/push/unsubscribe` | `{ endpoint }` |
| POST | `/push/test` | Notification d'essai |

## Administration et exploitation

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/health` | Public : `{ status, cards, images }` |
| GET | `/admin/catalog/status` | En-tête `x-admin-token` : état du catalogue et des médias |
| POST | `/admin/catalog/import` | En-tête `x-admin-token` ; `{ source: 'wikidata' \| 'seed' \| 'media', limit? }` → 202 (tourne en arrière-plan) |
