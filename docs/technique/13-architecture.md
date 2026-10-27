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
| `progression` | Succès, récompense quotidienne, statistiques | `DailyStreak`, définitions des succès |
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
| 2 | Contextes `wallet` et `collection` | ⏳ |
| 3 | Contexte `progression` | ⏳ |
| 4 | Contexte `games` | ⏳ |
| 5 | Contexte `marketplace` | ⏳ |
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

## Tests de bout en bout

```bash
cd apps/api && npm run test:e2e
```

- `test/global-setup.ts` crée une base temporaire `garage_e2e_<horodatage>_<pid>` sur le serveur de `E2E_DATABASE_URL` (ou de `DATABASE_URL`). Il y applique les migrations (`prisma migrate deploy`), importe le jeu de cartes de secours et lance l'API compilée sur le port 3101.
- Pour ce lancement, le serveur tourne avec les tâches de fond accélérées (règlement des enchères et expiration des offres toutes les secondes), sans bots, sans import ni appel réseau sortant.
- `test/global-teardown.ts` arrête l'API puis supprime **uniquement** la base créée par ce lancement (`E2E_KEEP_DB=1` pour la garder). Aucune base existante n'est modifiée.
- Les tests passent par l'API comme un vrai client (cookies de session). La base n'est utilisée que pour préparer un état (solde, date d'expiration) et vérifier le résultat.

| Fichier | Scénarios |
| --- | --- |
| `security` | 401 sans session, routes publiques, chemins de fichiers, jeton d'administration, identifiants mal formés |
| `boosters` | Réserve de départ, 12 ouvertures simultanées pour 9 boosters, garantie Épique côté serveur, paramètres de tirage envoyés par le client sans effet |
| `games` | Aucune réponse divulguée, gains exacts, reprise de partie, réponses hors format, partie d'un autre joueur, cartes gagnées, limites quotidiennes |
| `shop` | Achat en rafale (1 seul débit), crédits insuffisants, offre inventée, prix envoyé par le client sans effet |
| `trades` | Séquestre, double acceptation, échange carte contre carte, validation des contreparties, annulation, expiration |
| `auctions` | Crédits bloqués, remboursement, minimum de surenchère, anti « dernière seconde », règlement, invendu, validation |
| `daily` | Une réclamation par jour même en rafale, carte du 7ᵉ jour, série remise à 1 |
| `zz-invariants` | Pour chaque joueur, solde = crédits de départ + somme du journal ; aucun solde ni aucune quantité négatifs |
