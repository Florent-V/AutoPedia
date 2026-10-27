# 13. Architecture DDD et hexagonale de l'API

Cette page décrit l'architecture de `apps/api` : contextes métier, couches, règles anti-triche, transactions et verrous. Elle retrace aussi les étapes de la refonte.

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
| `shared` | Noyau partagé : transactions, événements, erreurs métier, verrous joueur, horloge, aléatoire | `DomainError`, `Credits`, `PlayerLocks` |
| `identity` | Authentification (Better Auth), garde global, `@Public()`, `@CurrentUser()` | — |
| `wallet` | Solde et journal des crédits | `Wallet` |
| `collection` | Cartes possédées, boosters, tirage, garanties, fiche d'une carte vue par le joueur | `BoosterReserve`, ports `CarPool` et `OwnedCards` |
| `player` | Création de la fiche joueur à la première requête, profil composé `/me` | `PlayerProvisioning` |
| `statistics` | Modèle de lecture des statistiques d'un joueur (affichage et succès) | `PlayerStatsQuery` |
| `progression` | Succès et leurs récompenses, récompense quotidienne | `DailyStreak`, définitions des succès |
| `games` | Mini-jeux | `GameSession`, `QuestionFactory` (port) |
| `marketplace` | Boutique, bourse, enchères (et leurs tâches de fond) | `TradeOffer`, `Auction`, rotation de la boutique |
| `catalog` | Cartes, raretés, import Wikidata, photos, résumés, santé, administration | `CatalogReader`, raretés |
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
| 6 | Contextes `catalog` et `identity`, dotation des bots inscrite au journal, nettoyage final | ✅ |

La suite de bout en bout est restée verte à chaque étape.

## Où sont faits les contrôles anti-triche

Tous les contrôles sont faits **côté serveur**. Une requête modifiée à la main ne peut rien obtenir de plus qu'un clic normal.

| Tentative | Ce qui l'empêche | Couche |
| --- | --- | --- |
| Ajouter un champ (prix, carte, gagnant, rareté…) | `forbidNonWhitelisted` : 400 | `http/` (global) |
| Envoyer un montant négatif, décimal ou énorme | DTO (`@IsInt`, `@Min`, `@Max`), puis `Credits` et `positiveInt` dans le domaine | `http/` + `domain/` |
| Choisir le contenu d'un booster | Aucun paramètre accepté ; raretés tirées par le serveur (aléatoire cryptographique) | `domain/` |
| Ouvrir plus de boosters que la réserve | `BoosterReserve.consume` recalcule la réserve à partir de l'heure du serveur, sous verrou | `domain/` |
| Lire la bonne réponse d'un mini-jeu | `publicQuestion` retire tous les champs secrets ; la réponse ne quitte le serveur qu'après le choix | `domain/` |
| Deviner la position de la bonne réponse | Mélanges par aléatoire cryptographique | `infrastructure/` |
| Répondre deux fois, ou à la partie d'un autre | Verrou de la partie, statut vérifié par `GameSession`, partie cherchée par (id, joueur) | `application/` + `domain/` |
| Acheter en boutique à un autre prix, ou une offre passée | Offres recalculées par le serveur ; seule la clé est envoyée ; unicité (joueur, offre) | `application/` + base |
| Vendre une carte non possédée, ou deux fois | Séquestre par décrément conditionnel (`CardsService.take`) | `infrastructure/` |
| Dépenser plus que son solde | `Wallet.debit` (409), sous verrou, avec contrôle optimiste à l'écriture | `domain/` + `infrastructure/` |
| Accepter sa propre offre, une offre expirée, ou deux fois | `TradeOffer.accept` sous verrou | `domain/` |
| Surenchérir sous le minimum, sur soi-même, ou après la fin | `Auction.bid` sous verrou | `domain/` |
| Réclamer deux fois la récompense du jour, ou fausser la série | `DailyStreak.claim` : dates calculées par l'horloge du serveur | `domain/` |
| Toucher deux fois la récompense d'un succès | `INSERT … ON CONFLICT DO NOTHING RETURNING` avant le paiement | `application/` |
| Rafales de requêtes | Limitation de débit par joueur (429) | `http/` (global) |
| Faire appeler une adresse interne par le serveur (push) | Liste des services de notification autorisés | `domain/` |

## Socle partagé (`src/shared/`)

| Élément | Rôle |
| --- | --- |
| `domain/errors.ts` | `InvalidRequest` (400), `NotFound` (404), `Forbidden` (403), `RuleViolation` (409), `Unavailable` (503). Le domaine lève ces erreurs sans connaître HTTP |
| `domain/credits.ts`, `domain/guards.ts` | Objet-valeur `Credits` et contrôles de bornes (entiers positifs, plafonds) |
| `domain/domain-event.ts` | Contrat des événements de domaine (nom stable porté par la classe) |
| `application/ports.ts` | Ports `UnitOfWork`, `EventBus`, `PlayerLocks`, `Clock`, `RandomSource` |
| `domain/random.ts`, `domain/seeded.ts`, `domain/zoned-time.ts` | Mélange, aléatoire déterministe (boutique), dates dans le fuseau du jeu |
| `infrastructure/prisma/transaction.ts` | Accès à la transaction en cours (`Db`) et verrous joueur |
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

## Ajouter une fonctionnalité

Pour un développeur qui vient de Symfony : un contexte correspond à peu près à un *bundle*. Un cas d'usage correspond à un service applicatif (ou à un *handler* de commande Messenger). Les événements de domaine jouent le rôle des événements Symfony, avec deux moments d'écoute : dans la transaction, ou après validation.

1. **Règle métier** : l'écrire dans l'agrégat ou dans une fonction pure de `domain/`, avec son test unitaire. Lever une erreur métier (`RuleViolation`, `InvalidRequest`…), jamais une exception HTTP.
2. **Persistance** : déclarer un port (classe abstraite) dans `domain/` et l'implémenter dans `infrastructure/` avec `Db` (transaction en cours).
3. **Cas d'usage** : dans `application/`, ouvrir `uow.run(...)`, verrouiller (objet partagé puis joueurs), charger, appliquer la règle, enregistrer, puis publier un événement si d'autres contextes doivent réagir.
4. **Autres contextes** : n'utiliser que leurs services exportés (`WalletService`, `CardsService`, `CatalogReader`…), jamais leurs tables.
5. **HTTP** : un DTO strict (`class-validator`) et un contrôleur fin qui compose la réponse.
6. **Test de bout en bout** dans `test/e2e/` : chemin nominal, requêtes invalides ou enrichies, et concurrence si la fonctionnalité touche aux crédits ou aux cartes.

