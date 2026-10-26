# 12. Bots : implémentation

Règles du jeu vues par le joueur : [Bots](../fonctionnel/13-bots.md). Ce document décrit le code (`apps/api/src/bots/`).

## Principe

Les bots sont des **joueurs ordinaires** : une ligne `user`, sans ligne `account`, donc sans moyen de se connecter, et une ligne `player` avec `isBot = true`, une personnalité (`botProfile`, JSON) et une heure de prochain passage (`botNextActionAt`). Pour agir, ils appellent **les mêmes services que l'API** (`BoostersService`, `DailyService`, `AuctionsService`, `TradesService`). Toutes les règles s'appliquent donc à l'identique : verrous, séquestre, limites, commission, succès et récompenses. Aucune règle n'existe « pour les bots » côté économie, sauf leur revenu quotidien simulé (`bot:jeux` dans le journal des crédits).

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `bot-brain.ts` | Fonctions **pures**, testées : `botValuation`, `decideBid`, `acceptsPriceOffer`, `acceptsSwap`, `auctionStartPrice`, `tradeAskPrice`, préréglages des personnalités, pseudos |
| `bot-brain.spec.ts` | Tests : valeur plus haute pour une carte manquante, bonus de marque fétiche, jamais d'offre au-delà de la valeur, pas d'offre systématique, échanges équitables uniquement |
| `bots.service.ts` | Création des bots, boucle d'activité, enchaînement des actions |

## Boucle

```
toutes les BOTS_TICK_SECONDS (60 s) :
  si catalogue vide → rien
  ensureBots()          crée les bots manquants (jusqu'à BOTS_COUNT), arrivées étalées sur 1 h
  bots dus = player WHERE isBot AND botNextActionAt ≤ maintenant, au plus 4
  pour chacun :
    claimDaily      → DailyService.claim + moveCredits(80..320, 'bot:jeux')
    openBoosters    → BoostersService.open × 1..3 (si réserve)
    browseAuctions  → 8 enchères les plus proches de la fin, hors les siennes et celles qu'il mène
                       decideBid(...) → AuctionsService.bid (au plus 2, budget = 60 % du solde)
    browseTrades    → 10 offres récentes (celles des bots ignorées à 70 %) → TradesService.accept (au plus 1)
    sellDuplicate   → probabilité sellChance : AuctionsService.create (70 %) ou TradesService.create
    botNextActionAt = maintenant + activityMinutes × [0,5 ; 1,5] × (4 la nuit)
```

Chaque étape est isolée (`catch`) : une erreur métier (enchère surenchérie entre-temps, plus de crédits…) n'interrompt pas le passage. Un garde (`running`) empêche deux boucles de se chevaucher.

## Personnalités (`STYLE_PRESETS`)

| Style | bidChance | generosity | wantMissing | sellChance |
| --- | --- | --- | --- | --- |
| collectionneur | 0,55 | 1,0 | 1,45 | 0,15 |
| marchand | 0,7 | 0,75 | 1,0 | 0,5 |
| econome | 0,35 | 0,6 | 1,1 | 0,25 |
| passionne | 0,45 | 1,15 | 1,3 | 0,2 |

S'y ajoutent, tirés à la création : `activityMinutes` (10 à 45), `favoriteBrand` (70 % des bots, parmi les marques du catalogue) et `likesRacing` (30 %).

## Décisions

```
valeur = REF_VALUE[rareté]                          (40, 120, 400, 1200, 4000)
       × (wantMissing | 0,7 si 1 exemplaire | 0,4 si plusieurs)
       × 1,3 (marque fétiche) ou 1,8 (marque fétiche d'un passionné)
       × 1,3 (course, si likesRacing)
       × generosity × [0,85 ; 1,15]

decideBid : null si minBid > valeur
            chance = bidChance × 1,5 (fin < 15 min) × 1,3 (minBid < 60 % de la valeur) × 0,4 (vendeur bot), plafonnée à 95 %
            montant = min(valeur, minBid + [0 ; 12 %] × minBid)
```

## Interaction avec l'économie

- **Liquidité** : les bots démarrent avec 1 500 crédits et en gagnent chaque jour (récompense, revenu simulé, succès). Quand ils achètent à un joueur, ils lui transfèrent des crédits : c'est ce qui permet aux premiers joueurs de vendre.
- **Garde-fous** : budget de 60 % du solde par passage, jamais au-delà de la valeur estimée, préférence pour les offres des joueurs, faible appétit pour les ventes d'autres bots. Ce dernier point évite qu'ils s'échangent des cartes entre eux en boucle.
- **Puits** : la commission de 5 % des enchères s'applique aussi aux ventes des bots.

## Exploitation

- Arrêt : `BOTS_ENABLED=false` (les bots restent en base, inactifs).
- Voir l'activité : `SELECT u.name, p."boostersOpened", p.credits FROM player p JOIN "user" u ON u.id = p."userId" WHERE p."isBot";`
- Journal des crédits d'un bot : `credit_transaction` (motifs `bot:jeux`, `auction:*`, `trade:*`, `daily`, `achievement`).

## Pistes

- Réduire progressivement `BOTS_COUNT` en fonction du nombre de joueurs actifs.
- Activité indexée sur celle des humains (plus d'enchères quand il y a du monde).
- Mémoire des prix pratiqués, pour affiner les estimations.
