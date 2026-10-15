# 8. Boutique

La boutique est tenue par l'application : elle **vend des cartes contre des crédits**. Son contenu change **toutes les heures**.

## Programme quotidien et rotation horaire

Chaque jour (à minuit, heure de Paris), l'application établit **pour chaque rareté un ordre de passage secret** de toutes les cartes de cette rareté. Les rotations successives de la journée dévoilent cet ordre tranche par tranche :

| Rareté | Cartes en vente simultanément | Rotation | Cartes différentes par jour | Prix |
| --- | --- | --- | --- | --- |
| Commune | 3 | toutes les heures | 72 | 40 🪙 |
| Peu commune | 2 | toutes les heures | 48 | 120 🪙 |
| Rare | 2 | toutes les heures | 48 | 400 🪙 |
| Épique | 1 | toutes les 2 heures | 12 | 1 200 🪙 |
| Légendaire | 1 | toutes les 4 heures | 6 | 4 000 🪙 |

- Une carte n'apparaît **qu'une fois par jour**, sauf si la rareté compte moins de cartes que de places dans la journée.
- Le programme est **imprévisible** : il dépend d'une graine secrète, donc impossible de connaître à l'avance les cartes de demain.
- Il est **le même pour tous les joueurs** à un instant donné, ce qui permet d'en parler entre joueurs (« la Countach est en boutique jusqu'à 16 h ! »).

## Affaire de l'heure

À chaque heure, **une offre** (tirée au hasard parmi celles affichées) est remisée de **25 %**. Elle est mise en avant par un bandeau « Affaire de l'heure −25 % ».

## Règles d'achat

- **Un exemplaire par offre et par joueur.** L'offre affiche ensuite « Acheté ✓ ». Le même joueur peut racheter la carte si elle revient un autre jour.
- Il faut avoir assez de crédits : le bouton est grisé sinon.
- Si la boutique tourne pendant que le joueur hésite, l'achat est refusé avec le message « la boutique a tourné » et la page se met à jour.
- La carte achetée rejoint immédiatement la collection, comme une carte de booster (nouvelle carte ou exemplaire supplémentaire).

## Interface

- Compte à rebours jusqu'à la prochaine rotation et solde de crédits.
- Offres regroupées par rareté, de la Légendaire à la Commune.
- Pour les Épiques et les Légendaires : l'heure de fin de l'offre (« Jusqu'à 16:00 »).
- Toucher une carte ouvre sa fiche détaillée avant achat.
