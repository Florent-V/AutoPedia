# 13. Architecture DDD et hexagonale de l'API

Cette page décrit l'architecture cible de `apps/api` et suit l'avancement de la refonte. Elle est mise à jour à chaque étape.

## Principes

- **Un module NestJS par contexte métier** (*bounded context*). Un module n'expose que ses cas d'usage et ses ports, jamais ses repositories Prisma.
- **Quatre couches par contexte** :

| Dossier | Contenu | Dépend de |
| --- | --- | --- |
| `domain/` | Agrégats, objets-valeurs, règles, erreurs métier, ports (interfaces), événements de domaine. TypeScript pur : ni NestJS, ni Prisma | rien |
| `application/` | Cas d'usage (un par action du joueur), orchestration, transaction | `domain/` |
| `infrastructure/` | Repositories Prisma, mappers, adaptateurs externes (Wikidata, Web Push) | `domain/` et `application/` |
| `http/` | Contrôleurs et DTO validés | `application/` |

- **Le serveur décide de tout.** Le client n'envoie que des intentions (« ouvrir un booster », « acheter l'offre X », « répondre B »). Prix, raretés, gains, soldes, bonnes réponses et dates sont calculés ou relus côté serveur. Toute donnée envoyée en trop est refusée (400).
- **Défense en profondeur.** Les DTO valident la forme. Les objets-valeurs du domaine revalident les bornes (`Credits`, quantités…), les agrégats vérifient les règles, et la base garde ses contraintes (unicités, verrous `FOR UPDATE`).
- **Événements de domaine** plutôt qu'appels croisés. Par exemple, `BoosterOpened` ou `TradeCompleted` déclenchent l'évaluation des succès dans la même transaction, puis les notifications push après validation.
- **CQRS léger.** Les écritures passent par les agrégats. Les lectures (listes, collection, statistiques) peuvent interroger Prisma directement via des *query services*.

## Contextes

| Contexte | Responsabilité | Agrégats / objets principaux |
| --- | --- | --- |
| `shared` | Noyau partagé : transactions, événements, erreurs métier, horloge, aléatoire | `DomainError`, `Credits`, `Clock` |
| `wallet` | Solde et journal des crédits | `Wallet` |
| `collection` | Cartes possédées, boosters, tirage, garanties | `BoosterReserve`, `Draw` |
| `player` | Création de la fiche joueur à la première requête, profil composé `/me` | `PlayerProvisioning` |
| `statistics` | Modèle de lecture des statistiques d'un joueur (affichage et succès) | `PlayerStatsQuery` |
| `progression` | Succès et leurs récompenses, récompense quotidienne | `DailyStreak`, définitions des succès |
| `games` | Mini-jeux | `GameSession`, `QuestionFactory` (port) |
| `marketplace` | Boutique, bourse, enchères | `ShopOffer`, `TradeOffer`, `Auction` |
| `catalog` | Cartes, import Wikidata, photos | `Car` |
| `notifications` | Web Push | abonné aux événements |
| `bots` | Joueurs automatiques | consommateurs des cas d'usage |

## Avancement

| Étape | Contenu | État |
| --- | --- | --- |
| 0 | Suite de tests de bout en bout (vraie API, vraie base) qui rejoue les scénarios métier et anti-triche | ✅ |
| 1 | Socle partagé : transactions (CLS), événements de domaine, erreurs métier, durcissement HTTP | ✅ |
| 2 | Contextes `wallet`, `collection`, `player` et `statistics` | ✅ |
| 3 | Contexte `progression` (succès par événements, récompense quotidienne) | ✅ |
| 4 | Contexte `games` (agrégat `GameSession`, port `QuestionFactory`, aléatoire cryptographique) | ✅ |
| 5 | Contexte `marketplace` (agrégats `TradeOffer` et `Auction`, boutique), `notifications` (abonnés après validation), `bots` | ✅ |
| 6 | Contextes `catalog`, `notifications` et `bots`, nettoyage final | ⏳ |

La suite de bout en bout doit rester verte à chaque étape.

## Socle partagé (`src/shared/`)

| Élément | Rôle |
| --- | --- |
| `domain/errors.ts` | `InvalidRequest` (400), `NotFound` (404), `Forbidden` (403), `RuleViolation` (409), `Unavailable` (503). Le domaine lève ces erreurs sans connaître HTTP |
| `domain/credits.ts`, `domain/guards.ts` | Objet-valeur `Credits` et contrôles de bornes (entiers positifs, plafonds) |
| `domain/domain-event.ts` | Contrat des événements de domaine (nom stable porté par la classe) |
| `application/ports.ts` | Ports `UnitOfWork`, `EventBus`, `Clock`, `RandomSource` |
| `infrastructure/cls-unit-of-work.ts` | Transaction Prisma portée par le contexte de la requête (`nestjs-cls` + `@nestjs-cls/transactional`). Les appels imbriqués rejoignent la transaction en cours. Les événements sont livrés aux abonnés `@OnDomainEvent` dans la transaction, puis aux abonnés `@AfterCommit` après validation |
| `infrastructure/system.ts` | Horloge système et aléatoire cryptographique (`crypto.randomInt`) |
| `http/domain-error.filter.ts` | Traduit les erreurs métier en réponses HTTP ; une violation d'unicité en base (double requête) devient un 409 |
| `http/user-throttler.guard.ts` | Limitation de débit par joueur |

## Exemple : ouverture d'un booster

```
POST /api/boosters/open                               (aucun paramètre accepté)
  BoostersController            http/          compose la réponse (vues des cartes, statistiques)
  └─ BoostersService.open       application/   unité de travail + verrou joueur
       ├─ BoosterReserve        domain/        régénération, réserve vide → RuleViolation (409), garanties
       ├─ rollBoosterRarities   domain/        raretés des 5 emplacements (aléatoire cryptographique)
       ├─ CardsService.draw     application/   → port CarPool → adaptateur vers CatalogReader
       ├─ CardsService.grant    application/   → port OwnedCards → Prisma
       └─ EventBus.publish(BoosterOpened)
            └─ ProgressionHandlers   (même transaction) → AchievementsService.evaluate
                 └─ WalletService.credit (récompense) → agrégat Wallet → journal
  NewAchievementsInterceptor    http/          ajoute newAchievements à la réponse
```

## Verrous et ordre de verrouillage

- **Joueur** (`PlayerLocks`, ligne `player` en `FOR UPDATE`) : pris par toute action qui modifie le solde, la réserve ou les cartes d'un joueur. Plusieurs joueurs sont toujours verrouillés triés par identifiant.
- **Objet partagé d'abord** : une offre de la bourse ou une enchère est verrouillée *avant* les joueurs concernés (acceptation, offre, règlement). Aucune action ne prend un joueur puis une offre ou une enchère : pas de cycle, donc pas d'interblocage.
- **Partie de mini-jeu** : privée, verrouillée *après* son joueur.
- **Défense en profondeur** : le portefeuille vérifie aussi, à l'écriture, que le solde n'a pas changé depuis sa lecture (concurrence optimiste). La boutique repose en plus sur une contrainte d'unicité (joueur, offre), et le séquestre sur un décrément conditionnel (jamais de quantité négative).

## Tests de bout en bout

```bash
cd apps/api && npm run test:e2e
```

- `test/global-setup.ts` crée une base temporaire `garage_e2e_<horodatage>_<pid>` sur le serveur de `E2E_DATABASE_URL` (ou de `DATABASE_URL`). Il y applique les migrations (`prisma migrate deploy`), importe le jeu de cartes de secours et lance l'API compilée sur le port 3101.
- Pour ce lancement, le serveur tourne avec les tâches de fond accélérées (règlement des enchères et expiration des offres toutes les secondes), sans bots, sans import ni appel réseau sortant.
- Le journal du serveur de test est écrit dans `test/.logs/api.log`.
- `test/global-teardown.ts` arrête l'API puis supprime **uniquement** la base créée par ce lancement (`E2E_KEEP_DB=1` pour la garder). Aucune base existante n'est modifiée.
- Les tests passent par l'API comme un vrai client (cookies de session). La base n'est utilisée que pour préparer un état (solde, date d'expiration) et vérifier le résultat.

| Fichier | Scénarios |
| --- | --- |
| `security` | 401 sans session, routes publiques, chemins de fichiers, jeton d'administration, identifiants mal formés |
| `boosters` | Réserve de départ, 12 ouvertures simultanées pour 9 boosters, garantie Épique côté serveur, paramètres de tirage envoyés par le client sans effet |
| `games` | Aucune réponse divulguée, gains exacts, reprise de partie, réponses hors format, partie d'un autre joueur, cartes gagnées, limites quotidiennes |
| `shop` | Achat en rafale (1 seul débit), crédits insuffisants, offre inventée, prix envoyé par le client sans effet |
| `trades` | Séquestre, double acceptation, échange carte contre carte, validation des contreparties, annulation, expiration |
| `auctions` | Crédits bloqués, remboursement, minimum de surenchère, anti « dernière seconde », règlement, invendu, validation, deux offres simultanées |
| `daily` | Une réclamation par jour même en rafale, carte du 7ᵉ jour, série remise à 1 |
| `progression` | Succès signalés dans la réponse et payés une seule fois (rafales d'ouvertures et de consultations), journal du portefeuille |
| `zz-invariants` | Pour chaque joueur, solde = crédits de départ + somme du journal ; aucun solde ni aucune quantité négatifs |
