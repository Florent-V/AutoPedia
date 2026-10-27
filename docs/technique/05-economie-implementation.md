# 5. Économie : implémentation

## Briques communes

Toutes les fonctionnalités économiques passent par ces services, appelés **dans une unité de travail** (transaction portée par le contexte, voir [Architecture DDD](13-architecture.md)) :

| Service | Rôle |
| --- | --- |
| `PlayerLocks.lock(...ids)` (noyau partagé) | `SELECT … FOR UPDATE` sur les lignes `player`, **triées par identifiant** pour éviter les interblocages entre deux joueurs |
| `WalletService.credit / debit` (contexte `wallet`) | Seul point d'écriture du solde, via l'agrégat `Wallet` : montants entiers positifs (objet-valeur `Credits`), solde jamais négatif (409), ligne de journal avec le solde résultant, `creditsEarned` pour les gains, contrôle de concurrence optimiste à l'écriture |
| `CardsService.grant` (contexte `collection`) | `upsert` sur `user_card` ; renvoie `{ quantity, isNew }` |
| `CardsService.take` | Décrément conditionnel, ou suppression au dernier exemplaire ; 400 si la carte n'est pas possédée |
| `CardsService.draw(rareté, exclues)` | Carte active au hasard de la rareté voulue (ou de la plus proche) |

## Mini-jeux (contexte `games`)

### Cycle de vie d'une partie

```
POST /games/:type/start
  ├─ partie ACTIVE de moins d'une heure ? → la renvoyer (reprise)
  ├─ partie ACTIVE plus ancienne → FINISHED (abandon)
  ├─ parties du jour (fuseau GAME_TIMEZONE) ≥ GAMES_PER_DAY → 409
  └─ création : state = { used: [ids], current: question + réponse, history: [] }

POST /games/sessions/:id/answer { choice }
  ├─ verrou joueur, puis FOR UPDATE sur game_session (partie du joueur, sinon 404)
  ├─ agrégat GameSession : statut ACTIVE (409), forme de la réponse ('a' | 'b', 0..3, 0..2 : 400),
  │  jugement avec la manche gardée sur le serveur
  ├─ correct ? → WalletService.credit(+gain) ou CardsService.grant(carte en jeu)
  ├─ fin ? (dernière manche, ou erreur au duel)
  │    ├─ sans-faute → carte bonus (rareté de carte vedette) via CardsService
  │    └─ gamesPlayed++
  ├─ sinon : QuestionFactory génère la manche suivante (cartes déjà utilisées exclues)
  └─ événement GameRoundPlayed → succès évalués dans la même transaction
```

### Deux modes de récompense

`defineGames` (`games/domain/game-rules.ts`) décrit chaque jeu : nombre de manches, parties par jour, `reward` (`credits` ou `card`), arrêt à la première erreur, carte bonus pour un sans-faute, format de réponse attendu (`'a'`/`'b'`, 3 ou 4 choix).

| Type | Manches | Récompense | Réponse |
| --- | --- | --- | --- |
| `DUEL` | 10 (arrêt à la 1ʳᵉ erreur) | 10 🪙 par bonne réponse + bonus | `'a'`/`'b'` |
| `QUIZ` | 5 | 15 🪙 par bonne réponse + bonus | 0..3 |
| `WEIGHT` | 1 | la carte `prizeCarId` (la plus lourde) | `'a'`/`'b'` |
| `MYSTERY` | 1 | la carte `prizeCarId` (la carte montrée) | 0..3 |
| `DOORS` | 1 | la carte derrière la porte choisie | 0..2 |

Pour les jeux à carte, la question stockée contient `prizeCarId`. Pour les 3 garages, elle contient `outcomes` (`tier` et `carId` des trois portes). Ces champs sont retirés de la vue envoyée au client (`publicQuestion`, testé), au même titre que `answer`. La réponse à `answer` contient alors `prize` (la carte gagnée, avec `isNew` et `quantity`) et, pour les 3 garages, `doors` (le contenu révélé des trois portes). Les compteurs `gameCardsWon` et `doorsJackpots` du joueur alimentent les succès.

### Génération des questions (`games/infrastructure/sql-question-factory.ts`)

Tout l'aléatoire en mémoire (mélange des réponses, choix du critère, ordre des portes) passe par la source d'aléatoire **cryptographique** injectée. On ne peut donc pas déduire la position de la bonne réponse de tirages précédents.


- **Duel** : on choisit au hasard un critère (vitesse, puissance, masse, longueur, année, notoriété), puis on cherche parmi 40 voitures aléatoires qui ont ce critère une paire dont l'écart passe le seuil `minGap`. Si aucune paire ne convient, on essaie le critère suivant. Les noms de colonnes viennent d'une liste fixe : pas d'injection SQL possible.
- **Quiz** : on choisit un type au hasard (marque, pays, décennie, photo), puis une voiture qui a la donnée nécessaire, puis trois mauvaises réponses (`DISTINCT … ORDER BY random()`). Pour la photo, les mauvaises réponses sont d'abord prises dans la même marque. L'ordre des choix est mélangé, sauf pour les décennies.
- **Poids lourds** (`makeWeightRound`) : rareté de chaque voiture tirée avec `rollRarity(false)`, puis une voiture de cette rareté avec une masse connue ; 6 essais pour trouver une paire avec au moins 8 % d'écart (les 2 derniers sans contrainte de rareté), puis repli sur `makeDuelRound`.
- **Question pour une carte** (`makeMysteryRound`) : rareté tirée avec `rollRarity(false)`. Le type de question dépend de la rareté (pays, décennie, année exacte) et se rabat sur un type plus simple si la donnée manque. Les décennies proposées sont 4 décennies consécutives, la bonne étant à une position aléatoire ; les années sont 4 années distinctes à ±6 ans au plus, triées.
- **Les 3 garages** (`makeDoorsRound`) : une carte Commune ou Peu commune (70/30) et d'une Épique ou Légendaire (80/20), plus une porte vide, dans un ordre mélangé.
- **Vue client** : `publicQuestion()` retire `answer`, `reveal`, `carId`, `prizeCarId` et `outcomes` de la question avant de l'envoyer. Les cartes de jeu (`gameCard`) ne contiennent que l'identifiant, le nom, la marque, l'image et la rareté : aucune valeur qui donnerait la réponse.

## Boutique (contexte `marketplace`)

### Rotation (`marketplace/domain/shop-rotation.ts`, fonctions pures et testées)

Pour une date `D` (dans le fuseau du jeu), une heure `h` et une rareté `r` :

```
programme(r, D) = mélange déterministe (Fisher-Yates + mulberry32)
                  des identifiants de cartes actives de rareté r,
                  avec la graine sha256(SECRET : D : r)

rotation      = ⌊h / toutesLesNHeures(r)⌋
offre n° i    = programme[(rotation × parRotation(r) + i) mod taille]
clé d'offre   = « D T HH : r : i »   (HH = début de la rotation)
affaire       = une offre de l'heure tirée avec la graine (SECRET : D : h : deal), −25 %
```

Propriétés vérifiées par les tests :

- **stable** pendant l'heure, et **différente** à l'heure suivante ;
- **aucune répétition** dans la journée tant que la rareté a assez de cartes ;
- les Légendaires gardent la même clé pendant 4 heures (donc un seul achat possible sur toute la période) ;
- exactement **une affaire** par heure.

Aucune table ne stocke le programme : il est **recalculé** à chaque requête à partir de la liste des cartes et de la graine. Si le catalogue change en cours de journée (import), le programme du jour change aussi. C'est acceptable, et la contrainte d'unicité des achats reste cohérente.

### Achat (`ShopService.buy`)

Transaction : verrou joueur, recalcul des offres de l'heure courante, offre introuvable → 404 (« la boutique a tourné »), création de `shop_purchase` (l'unicité `(userId, offerKey)` empêche le double achat), puis `WalletService.debit(prix)`, `CardsService.grant`, `shopPurchases++` et événement `ShopCardPurchased` (succès). Le client n'envoie que la clé de l'offre : carte et prix viennent du serveur. Si les crédits manquent, tout est annulé. Testé : 5 achats simultanés de la même offre donnent 1 succès, 4 refus et un seul débit.

## Bourse d'échanges (contexte `marketplace`, agrégat `TradeOffer`)

### Création

Transaction : verrou vendeur, plafond d'offres ouvertes, existence de la carte demandée, puis **`CardsService.take` (séquestre)** et création de l'offre (`expiresAt = maintenant + TRADE_DAYS`). Exactement l'une des deux contreparties doit être renseignée : `wantedCarId` ou `price`.

### Acceptation

```
transaction :
  FOR UPDATE trade_offer → TradeOffer.accept : statut OPEN ; acheteur ≠ vendeur ; pas expirée
  PlayerLocks.lock(acheteur, vendeur)     (offre puis joueurs triés → pas d'interblocage)
  si carte demandée : take(acheteur, demandée) ; grant(vendeur, demandée)
  sinon             : debit(acheteur, prix, trade:purchase)
                      credit(vendeur, prix, trade:sale)
  grant(acheteur, carte proposée)
  statut COMPLETED, buyerId ; tradesCompleted++ pour les deux
  événement TradeCompleted → succès des deux joueurs (même transaction)
après validation : notification push au vendeur (abonné @AfterCommit)
```

Testé : deux acceptations simultanées donnent 200 et 409.

### Annulation et expiration

Le retrait (`TradeOffer.cancel`, vendeur seulement) et l'expiration (`TradeOffer.expire`) rendent la carte au vendeur (`CardsService.grant`) et passent l'offre en CANCELLED. L'expiration est traitée par `TradesService.expireDue()` (tâche `MarketJobs`), 3 secondes après le démarrage puis toutes les `TRADE_EXPIRE_SECONDS` (10 minutes par défaut). Chaque offre est traitée dans sa propre transaction avec verrou. Les listes filtrent de toute façon `expiresAt > maintenant`, et une acceptation après expiration est refusée même si le nettoyage n'est pas encore passé.

### Onglet « Pour moi »

Requête : offres des autres joueurs dont la carte proposée **n'est pas** dans ma collection, **et** dont la carte demandée est dans ma collection **ou** dont le prix est inférieur ou égal à mon solde.

## Enchères (contexte `marketplace`, agrégat `Auction`)

### Création

Transaction : verrou vendeur, plafond `MAX_OPEN_AUCTIONS`, durée parmi `[1, 3, 6, 12, 24]` h, **séquestre** (`CardsService.take`), création avec `endsAt = maintenant + durée`.

### Offre (`bid`)

```
transaction :
  FOR UPDATE auction → Auction.bid : OPEN ; endsAt > maintenant ; montant entier borné
  refus : vendeur, meilleur enchérisseur actuel, montant < minBid
  minBid = currentBid ? currentBid + max(1, ⌈5 % × currentBid⌉) : startPrice
  si endsAt − maintenant < 120 s → endsAt = maintenant + 120 s  ← anti « dernière seconde »
  PlayerLocks.lock(enchérisseur, ancien meilleur enchérisseur)
  debit(enchérisseur, montant, 'auction:bid')                  ← crédits bloqués
  credit(ancien, son montant, 'auction:refund')                ← remboursement immédiat
  bid + mise à jour de l'enchère ; événement AuctionOutbid
après validation : notification push « surenchéri » à l'ancien meilleur enchérisseur
```

### Règlement (`settleDue`, toutes les 30 s et 3 s après le démarrage)

Pour chaque enchère OPEN échue, dans sa propre transaction et sous verrou : `Auction.settle` décide : sans offre → carte rendue au vendeur et UNSOLD ; avec offre → carte à l'acheteur, `credit(vendeur, montant − commission, 'auction:sale')`, compteurs `auctionsWon` / `auctionsSold`, SOLD. L'événement `AuctionSettled` déclenche les succès des deux joueurs (même transaction), puis les notifications (après validation). La commission (`AUCTION_FEE_PERCENT`, 5 %) n'est versée à personne : elle sort de l'économie.

Tests réalisés : offre trop basse (400), surenchère sur soi-même (409), remboursement exact du surenchéri, prolongation à 120 s, annulation refusée après une offre (409), règlement (carte au gagnant, 25 − 5 % = 24 crédits au vendeur), annulation sans offre.

## Récompense quotidienne (contexte `progression`, agrégat `DailyStreak`)

`claim` : verrou joueur ; `today` et `yesterday` calculés dans `GAME_TIMEZONE` ; refus si `lastDailyClaim = today` ; `streak = lastDailyClaim = yesterday ? dailyStreak + 1 : 1` ; récompense `DAILY_REWARDS[(streak − 1) mod 7]`. Les boosters sont ajoutés (`BoosterReserve.grant`) après application de la régénération en cours, et peuvent dépasser le maximum (`computeBoosters` renvoie alors « plein » sans plafonner). La carte du jour 7 est tirée par `CardsService.draw` (Épique, ou Légendaire à 20 %). Mise à jour de la série et de la meilleure série, puis évaluation des succès.

## Récompenses des succès

`AchievementsService.evaluate` insère chaque succès atteint avec `INSERT … ON CONFLICT DO NOTHING RETURNING`, et ne verse `TIER_REWARD[palier]` (`WalletService.credit`, motif `achievement`) que si la ligne a effectivement été insérée. L'évaluation est déclenchée par les événements de domaine des autres contextes (`BoosterOpened`, `GameRoundPlayed`, `ShopCardPurchased`, `TradeCompleted`, `AuctionSettled`), dans la même transaction. Les succès débloqués pendant une requête sont ajoutés à sa réponse (`newAchievements`) par un intercepteur. Deux évaluations concurrentes (par exemple les deux joueurs d'un échange, ou une page Succès ouverte pendant une ouverture de booster) ne peuvent donc pas payer deux fois.
