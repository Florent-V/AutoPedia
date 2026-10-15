# 5. Économie : implémentation

## Portefeuille (`src/economy/wallet.ts`)

Toutes les fonctionnalités économiques passent par quatre fonctions, à appeler **dans une transaction** :

| Fonction | Rôle |
| --- | --- |
| `lockPlayers(tx, ...ids)` | `SELECT … FOR UPDATE` sur les lignes `player`, **triées par identifiant** pour éviter les interblocages entre deux joueurs |
| `moveCredits(tx, userId, montant, motif, ref)` | Seul point d'écriture du solde ; refuse un solde négatif (409) ; ajoute une ligne au journal avec le solde résultant ; incrémente `creditsEarned` pour les gains |
| `addCard(tx, userId, carId)` | `upsert` sur `user_card` ; renvoie `{ quantity, isNew }` |
| `removeCard(tx, userId, carId)` | Décrémente la quantité, ou supprime la ligne au dernier exemplaire ; 400 si la carte n'est pas possédée |

## Mini-jeux (`src/games/`)

### Cycle de vie d'une partie

```
POST /games/:type/start
  ├─ partie ACTIVE de moins d'une heure ? → la renvoyer (reprise)
  ├─ partie ACTIVE plus ancienne → FINISHED (abandon)
  ├─ parties du jour (fuseau GAME_TIMEZONE) ≥ GAMES_PER_DAY → 409
  └─ création : state = { used: [ids], current: question + réponse, history: [] }

POST /games/sessions/:id/answer { choice }
  ├─ FOR UPDATE sur game_session ; statut ACTIVE obligatoire
  ├─ validation de la forme ('a' | 'b' ou 0..3)
  ├─ correct ? → moveCredits(+gain)
  ├─ fin ? (dernière manche, ou erreur au duel)
  │    ├─ sans-faute → carte bonus (rareté de carte vedette) via addCard
  │    └─ gamesPlayed++, évaluation des succès
  └─ sinon : génération de la question suivante (cartes déjà utilisées exclues)
```

### Génération des questions (`questions.ts`)

- **Duel** : on choisit au hasard un critère (vitesse, puissance, masse, longueur, année, notoriété), puis on cherche parmi 40 voitures aléatoires qui ont ce critère une paire dont l'écart passe le seuil `minGap`. Si aucune paire ne convient, on essaie le critère suivant. Les noms de colonnes viennent d'une liste fixe : pas d'injection SQL possible.
- **Quiz** : on choisit un type au hasard (marque, pays, décennie, photo), puis une voiture qui a la donnée nécessaire, puis trois mauvaises réponses (`DISTINCT … ORDER BY random()`). Pour la photo, les mauvaises réponses sont d'abord prises dans la même marque. L'ordre des choix est mélangé, sauf pour les décennies.
- **Vue client** : `view()` retire `answer`, `reveal` et `carId` de la question avant de l'envoyer. Les cartes de jeu (`gameCard`) ne contiennent que l'identifiant, le nom, la marque, l'image et la rareté : aucune valeur qui donnerait la réponse.

## Boutique (`src/shop/`)

### Rotation (`shop-rotation.ts`, fonctions pures et testées)

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

Transaction : verrou joueur, recalcul des offres de l'heure courante, offre introuvable → 404 (« la boutique a tourné »), création de `shop_purchase` (l'unicité `(userId, offerKey)` empêche le double achat), puis `moveCredits(−prix)`, `addCard`, `shopPurchases++` et évaluation des succès. Si les crédits manquent, tout est annulé. Testé : 5 achats simultanés de la même offre donnent 1 succès, 4 refus et un seul débit.

## Bourse d'échanges (`src/trades/`)

### Création

Transaction : verrou vendeur, plafond d'offres ouvertes, existence de la carte demandée, puis **`removeCard` (séquestre)** et création de l'offre (`expiresAt = maintenant + TRADE_DAYS`). Exactement l'une des deux contreparties doit être renseignée : `wantedCarId` ou `price`.

### Acceptation

```
transaction :
  FOR UPDATE trade_offer ; statut OPEN ; pas expirée ; acheteur ≠ vendeur
  lockPlayers(acheteur, vendeur)          (ordre fixe → pas d'interblocage)
  si carte demandée : removeCard(acheteur, demandée) ; addCard(vendeur, demandée)
  sinon             : moveCredits(acheteur, −prix, trade:purchase)
                      moveCredits(vendeur, +prix, trade:sale)
  addCard(acheteur, carte proposée)
  statut COMPLETED, buyerId ; tradesCompleted++ pour les deux
  évaluation des succès pour les deux
après la transaction : notification push au vendeur (sans bloquer la réponse)
```

Testé : deux acceptations simultanées donnent 200 et 409.

### Annulation et expiration

`close()` rend la carte au vendeur (`addCard`) et passe l'offre en CANCELLED. L'expiration est traitée par `TradesService.expire()`, 5 secondes après le démarrage puis toutes les 10 minutes. Chaque offre est traitée dans sa propre transaction avec verrou. Les listes filtrent de toute façon `expiresAt > maintenant`, et une acceptation après expiration est refusée même si le nettoyage n'est pas encore passé.

### Onglet « Pour moi »

Requête : offres des autres joueurs dont la carte proposée **n'est pas** dans ma collection, **et** dont la carte demandée est dans ma collection **ou** dont le prix est inférieur ou égal à mon solde.
