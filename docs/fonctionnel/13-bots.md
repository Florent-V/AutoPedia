# 13. Bots : faire vivre le marché au lancement

Au lancement de l'application, il y a peu de joueurs : la bourse et les enchères resteraient vides, et une carte mise en vente ne trouverait pas preneur. Pour amorcer le marché, l'application fait tourner des **joueurs automatiques (bots)**. Ils jouent avec **les mêmes règles** que les joueurs humains.

## Ce que fait un bot

Un bot « passe » de temps en temps : toutes les 10 à 45 minutes selon son tempérament, de façon irrégulière, et **4 fois moins souvent la nuit** (1 h à 7 h). À chaque passage :

1. **Récompense du jour** : il la réclame une fois par jour, et touche en plus un revenu simulant ses parties de mini-jeux (80 à 320 crédits par jour).
2. **Boosters** : il ouvre 1 à 3 boosters de sa réserve (s’il en a), qui se régénère comme pour tout le monde. Sa collection grandit donc naturellement, et il débloque des succès (avec leurs récompenses).
3. **Enchères** : il regarde les enchères qui finissent le plus tôt et, **parfois**, enchérit. Au plus 2 offres par passage, avec au plus 60 % de son solde.
4. **Bourse** : il regarde les offres récentes, **en priorité celles des joueurs**, et accepte au plus un échange par passage, s'il le trouve avantageux.
5. **Ventes** : de temps en temps, il met un **doublon** en vente, le plus souvent aux enchères (mise à prix basse, 1 à 12 h), sinon à la bourse. Au plus 2 ventes en cours de chaque type.

## Comment un bot décide

Chaque bot a une **personnalité**, tirée à sa création :

| Personnalité | Tempérament |
| --- | --- |
| Collectionneur | Valorise fortement les cartes qui lui manquent ; vend peu |
| Marchand | Enchérit souvent mais paie peu ; revend beaucoup, un peu cher |
| Économe | Enchérit rarement et petit |
| Passionné | Fan d'une marque : il paie jusqu'à 1,8 fois plus pour elle |

Beaucoup ont aussi une **marque fétiche** et certains un faible pour les **voitures de course**.

**Valeur estimée d'une carte** = valeur de référence de la rareté (le prix boutique : 40, 120, 400, 1 200, 4 000), ajustée selon :

- s'il l'a déjà : ×1,0 à ×1,45 si elle lui manque, ×0,7 s'il en a un exemplaire, ×0,4 s'il en a plusieurs ;
- sa marque fétiche, son goût pour la course ;
- sa générosité (de ×0,6 à ×1,15) ;
- son humeur du moment (±15 %).

**Enchérir, mais pas toujours** : si l'offre minimale dépasse sa valeur estimée, il passe. Sinon, il enchérit avec une **probabilité** qui dépend de son tempérament (de 35 à 70 %). Elle augmente si l'enchère se termine dans moins de 15 minutes ou si l'affaire est bonne, et elle diminue fortement quand le vendeur est un autre bot. Son offre ne dépasse **jamais** sa valeur estimée. Un joueur peut donc toujours le battre en mettant le prix.

**Échanges** : il achète une carte à la bourse si le prix est inférieur à 90 % de sa valeur estimée. Il accepte un échange carte contre carte seulement s'il **garde au moins un exemplaire** de la carte demandée et si ce qu'il reçoit vaut au moins 90 % de ce qu'il donne.

## Transparence

Les bots sont **signalés par 🤖** à côté de leur pseudo, partout où un pseudo apparaît (enchères, bourse). Un message au survol explique leur rôle. C'est un choix délibéré : ils servent à amorcer l'activité, pas à faire croire à une communauté qui n'existe pas. Le cacher serait trompeur pour les premiers joueurs et risqué pour la réputation de l'application.

Les bots n'ont **pas de compte de connexion** : personne ne peut se connecter à leur place.

## Mêmes règles que les joueurs

Les bots passent par les mêmes actions que les joueurs, avec les mêmes contrôles : solde, séquestre, offre minimale, prix plancher, commission. Ils ne sont dispensés que de l'ancienneté de compte exigée pour accéder au marché, puisqu'ils sont pilotés par le serveur et ne peuvent pas servir à transférer des biens.

## Réglages

| Variable | Défaut | Effet |
| --- | --- | --- |
| `BOTS_ENABLED` | `true` | `false` pour arrêter les bots (ils restent en base, inactifs) |
| `BOTS_COUNT` | 12 | Nombre de bots (16 au maximum) |
| `BOTS_START_CREDITS` | 1 500 | Crédits de départ de chaque bot |
| `BOTS_TICK_SECONDS` | 60 | Fréquence de la boucle (chaque bot n'agit qu'à son heure) |

Quand la communauté aura grandi, on pourra réduire leur nombre, puis les arrêter avec `BOTS_ENABLED=false`.
