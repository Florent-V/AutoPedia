# 2. Modèle de données

Le schéma complet, commenté, se trouve dans `apps/api/prisma/schema.prisma`. Les migrations sont versionnées dans `apps/api/prisma/migrations/` et appliquées au démarrage du conteneur (`prisma migrate deploy`).

## Schéma

```
user ─┬─< session, account            (Better Auth)
      ├── player                       état de jeu (1-1)
      ├─< user_card >── car            collection (quantité par carte)
      ├─< booster_opening              historique des ouvertures
      ├─< user_achievement             succès débloqués
      ├─< credit_transaction           journal des crédits
      ├─< game_session                 parties de mini-jeux
      ├─< shop_purchase                achats en boutique
      ├─< trade_offer (vendeur / acheteur) >── car (proposée / demandée)
      └─< push_subscription            appareils abonnés aux notifications
```

## Tables

### Authentification (format imposé par Better Auth)

`user`, `session`, `account` (le mot de passe haché est dans `account.password`), `verification`.

### `car`, le catalogue

| Colonne | Rôle |
| --- | --- |
| `externalId` | QID Wikidata (`Q172146`) ou `seed:<slug>` pour le jeu de secours |
| `name`, `manufacturer`, `country`, `yearStart`, `yearEnd` | Identité |
| `powerKw`, `topSpeedKmh`, `massKg`, `lengthMm` | Caractéristiques (souvent partielles) |
| `racing` | Voiture de course |
| `popularity` | Nombre de Wikipédias ayant un article (sert à calculer la rareté) |
| `rarity`, `rarityOverride` | Rareté calculée / forcée manuellement (la seconde l'emporte) |
| `wikiTitle`, `wikiLang`, `summary`, `summaryFetchedAt` | Article et résumé Wikipédia |
| `imageFile` | Nom du fichier sur Commons |
| `imagePath` | Copie locale (relative à `MEDIA_DIR`) |
| `imageUrl` | Image distante, utilisée en repli |
| `imageAuthor`, `imageLicense`, `imageLicenseUrl` | Crédits de la photo |
| `imageCheckedAt` | Dernière tentative de téléchargement |
| `active` | Carte présente dans le jeu |

### `player`, l'état de jeu

| Colonne | Rôle |
| --- | --- |
| `boosters`, `boosterAnchor` | Réserve et ancre du minuteur (voir [Moteur de jeu](04-moteur-de-jeu.md)) |
| `fullNotifiedAnchor` | Évite de notifier deux fois le même remplissage |
| `sinceEpic`, `sinceLegendary` | Compteurs de garantie |
| `credits`, `creditsEarned` | Solde et cumul gagné (hors bonus de bienvenue) |
| `boostersOpened`, `cardsObtained`, `gamesPlayed`, `tradesCompleted`, `shopPurchases` | Compteurs pour les statistiques et les succès |

La ligne `player` est créée à la première requête du joueur (`upsert`), avec 10 boosters et 100 crédits.

### Collection et historique

- `user_card (userId, carId)` : **une ligne par carte possédée**, avec `quantity ≥ 1`. La ligne est supprimée quand la quantité tombe à 0 : toute ligne présente signifie donc « possédée ».
- `booster_opening` : identifiants des cartes tirées, avec la date.
- `user_achievement (userId, achievementId)` : succès débloqués. Les définitions sont dans le code, pas en base.

### Économie

- `credit_transaction` : `amount` (positif ou négatif), `reason` (`game:duel`, `game:quiz`, `shop`, `trade:sale`, `trade:purchase`), `ref` (identifiant de l'objet concerné), `balance` (solde après opération).
- `game_session` : `type` (DUEL ou QUIZ), `status`, `round`, `score`, `credits`, `rewardCarId`, et `state` (JSON) qui contient la question en cours **avec sa réponse** (jamais renvoyée au client) et les cartes déjà utilisées.
- `shop_purchase` : `offerKey` (unique par joueur, ce qui empêche le double achat), `carId`, `price`.
- `trade_offer` : `offeredCarId`, `wantedCarId` **ou** `price`, `status` (OPEN, COMPLETED, CANCELLED), `buyerId`, `expiresAt`.

### Notifications

`push_subscription` : un appareil par ligne (`endpoint` unique et clés de chiffrement).

## Invariants garantis par le code

| Invariant | Mécanisme |
| --- | --- |
| Un booster ne peut pas être ouvert deux fois | Verrou `FOR UPDATE` sur `player` |
| Le solde ne devient jamais négatif | Vérification sous verrou dans `moveCredits` |
| Chaque mouvement de crédits est journalisé | `moveCredits` est le seul point d'écriture de `credits` |
| Une carte en bourse n'existe qu'une fois | Séquestre : retirée de `user_card` à la publication |
| Une offre n'est acceptée qu'une fois | Verrou `FOR UPDATE` sur `trade_offer` + vérification du statut |
| Une offre de boutique n'est achetée qu'une fois par joueur | Contrainte d'unicité `(userId, offerKey)` |
| Une manche de mini-jeu n'est jouée qu'une fois | Verrou `FOR UPDATE` sur `game_session` |
| Pas d'interblocage entre deux joueurs | Verrous toujours pris dans l'ordre des identifiants (`lockPlayers`) |
