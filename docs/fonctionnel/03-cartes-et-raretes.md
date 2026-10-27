# 3. Cartes et raretés

## Ce que montre une carte

```
┌──────────────────────────────┐
│ Ferrari F40              [L] │  ← nom + pastille de rareté
│ ┌──────────────────────────┐ │
│ │  photo (ou dessin        │ │  ← photo Wikimedia, sinon dessin technique
│ │  technique du modèle)    │ │     (3 silhouettes selon l'époque)
│ └──────────────────────────┘ │
│ Ferrari                      │  ← marque
│ Italie · 1987–1992           │  ← pays · années de production
│ [478 ch] [324 km/h] [1 100kg]│  ← 3 caractéristiques disponibles
│ LÉGENDAIRE            100 PTS│  ← rareté + points
└──────────────────────────────┘
```

- **Caractéristiques** : parmi la puissance, la vitesse maximale, la masse et la longueur, la carte affiche les **trois premières disponibles**. Wikidata est inégalement renseigné : la puissance est rare, la longueur et la masse sont fréquentes.
- **Photo** : celle de Wikimedia Commons, stockée sur notre serveur. À défaut, un **dessin technique** façon plan, sur une grille, aux couleurs de la rareté, avec trois profils selon l'époque (avant 1950, de 1950 à 1989, après 1990).
- **Badge 🏁** : la voiture est une voiture de course (F1, endurance, rallye…).
- **Fiche détaillée** (au toucher) : toutes les données, le résumé Wikipédia, le lien vers l'article, les **crédits de la photo** (auteur, licence) et le bouton « Proposer à l'échange ».

## Les 5 raretés

| Rareté | Couleur | Points | Effet visuel |
| --- | --- | --- | --- |
| Commune | Gris | 1 | — |
| Peu commune | Vert | 3 | — |
| Rare | Bleu | 10 | Halo bleu au dos avant révélation |
| Épique | Violet | 30 | **Holographique** (reflet arc-en-ciel qui suit le doigt ou la souris, inclinaison 3D) |
| Légendaire | Or | 100 | **Holographique** + paillettes animées + halo doré |

## Comment une voiture devient rare : la notoriété

La rareté **ne dépend pas d'un choix manuel** : elle vient de la **notoriété** du modèle, mesurée par le **nombre d'éditions de Wikipédia** (toutes langues confondues) qui lui consacrent un article. C'est une donnée objective et disponible pour tous les modèles. Une Ford T ou une Coccinelle ont des articles dans plus de 60 langues ; un modèle obscur n'en a que 3.

Le catalogue est trié de la plus célèbre à la moins célèbre, puis découpé :

| Rareté | Part du catalogue | Exemple pour 3 000 voitures |
| --- | --- | --- |
| Légendaire | les 2 % les plus célèbres | 60 cartes |
| Épique | les 6 % suivants | 180 cartes |
| Rare | les 15 % suivants | 450 cartes |
| Peu commune | les 27 % suivants | 810 cartes |
| Commune | les 50 % restants | 1 500 cartes |

Conséquences voulues :

- les voitures **mythiques** (Ford T, Coccinelle, 2CV, Bugatti Veyron, Porsche 911…) sont les plus rares, donc les plus désirables ;
- la rareté est **recalculée à chaque import** du catalogue : elle suit l'évolution de Wikipédia ;
- un administrateur peut **forcer** la rareté d'une carte (colonne `rarityOverride`). Les imports ne l'écrasent jamais.

## Probabilités de tirage

### Par emplacement

| Rareté | Cartes 1 à 4 | Carte 5 (vedette) |
| --- | --- | --- |
| Commune | 62 % | — |
| Peu commune | 26 % | 55 % |
| Rare | 9 % | 33 % |
| Épique | 2,5 % | 9,5 % |
| Légendaire | 0,5 % | 2,5 % |

Une fois la rareté tirée, la carte est choisie **uniformément** parmi les cartes de cette rareté.

### Résultats mesurés (simulation de 300 000 boosters, garanties incluses)

| Indicateur | Valeur |
| --- | --- |
| Part des cartes obtenues : Commune / Peu commune / Rare / Épique / Légendaire | 49,5 % / 31,6 % / 13,7 % / 4,2 % / 1,0 % |
| Boosters contenant au moins une Rare | 68 % |
| Boosters contenant au moins une Épique | 24 % (environ 1 sur 4) |
| Boosters contenant une Légendaire | 5,1 % (environ 1 sur 20) |
| Pire série sans Épique | 9 boosters (garantie) |
| Pire série sans Légendaire | 59 boosters (garantie) |

### Est-ce bien réglé ?

- **Rythme** : un joueur assidu ouvre environ 15 à 25 boosters par jour. Il voit donc une Légendaire tous les un ou deux jours, et plusieurs Épiques par jour. Les moments forts sont réguliers sans devenir banals.
- **Compléter le catalogue** prend des mois avec les seuls boosters : pour obtenir les 60 Légendaires, il faut statistiquement environ 280 tirages de Légendaires, soit des milliers de boosters. C'est voulu, et c'est là qu'interviennent la **boutique** (qui permet de cibler une rareté) et la **bourse** (qui permet d'échanger ses doublons).
- **Avant correction**, la variance posait problème (jusqu'à 200 boosters sans Légendaire). Les **garanties** l'ont corrigée.
- Tous les réglages sont centralisés dans `apps/api/src/modules/catalog/domain/rarity.ts` (raretés, poids de tirage), `apps/api/src/modules/collection/domain/booster-draw.ts` (garanties) et dans les variables `PITY_*`.

## Points de collection

Le score d'un joueur est la **somme des points de ses cartes différentes**. Les doublons ne comptent pas dans le score, mais ils servent à la bourse. Donner son dernier exemplaire d'une carte fait donc baisser le score.
