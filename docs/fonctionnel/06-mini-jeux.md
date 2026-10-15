# 6. Mini-jeux

Les mini-jeux mettent en valeur les données du catalogue : on apprend des choses sur les voitures en jouant. Il y en a deux familles :

| Famille | Jeux | Récompense | Parties par jour |
| --- | --- | --- | --- |
| **Jeux rapides** | ⚖️ Poids lourds · 🃏 Question pour une carte · 🚪 Les 3 garages | **Une carte**, gagnée en une seule action | 5 · 5 · 2 |
| **Jeux à crédits** | ⚔️ Duel de stats · 🧠 Quiz auto | **Des crédits** à chaque bonne réponse, plus une carte bonus pour un sans-faute | 3 · 3 |

## Règles communes

- **Un nombre de parties par jour propre à chaque jeu** : 3 pour les jeux à crédits (`GAMES_PER_DAY`), 5 pour Poids lourds et Question pour une carte (`QUICK_GAMES_PER_DAY`), 2 pour les 3 garages (`DOORS_PER_DAY`). Le compteur repart à **minuit, heure de Paris** (`GAME_TIMEZONE`). La page Jeux affiche les parties restantes (pastilles vertes) et le temps avant les nouvelles parties.
- **Une partie commencée compte**, même abandonnée. Revenir sur le jeu **reprend la partie en cours**, dans l'heure qui suit : impossible de relancer une partie pour tomber sur des questions plus faciles. Passé ce délai, la partie est considérée comme abandonnée.
- Jeux à crédits : les **crédits sont gagnés à chaque bonne réponse**, immédiatement, donc abandonner en cours de route ne fait pas perdre ce qui est acquis. **Sans-faute = carte bonus**, tirée comme une carte vedette de booster (Peu commune ou mieux).
- Jeux rapides : la carte gagnée rejoint immédiatement la collection, comme une carte de booster.
- Le **meilleur score** des jeux à crédits est affiché.
- Toutes les réponses sont vérifiées par le serveur : voir [Sécurité](../technique/03-authentification-securite.md#anti-triche).

## ⚖️ Poids lourds

> « Laquelle est la plus lourde ? »

- Deux voitures sur la balance, un seul toucher : **la plus lourde est à vous** si vous la désignez.
- La rareté de chacune des deux voitures est tirée **comme une carte de booster** (62 % Commune… 0,5 % Légendaire) : la valeur moyenne d'une victoire reste comparable à celle d'une carte de booster. La rareté est affichée sous chaque voiture, ce qui ajoute un dilemme : faut-il miser sur ce qu'on sait, ou sur ce qu'on veut ?
- Les deux masses diffèrent toujours d'au moins 8 %. Elles sont révélées après la réponse (« 1 422 kg » contre « 1 768 kg »).
- Si le catalogue manque de masses connues, la question porte sur un autre critère du Duel de stats (vitesse, longueur…). C'est rare avec le catalogue complet.

## 🃏 Question pour une carte

> Une carte, une question, quatre réponses. Bonne réponse = carte gagnée.

La carte en jeu est **visible** (photo, nom, marque, rareté). Sa rareté est tirée comme une carte de booster. Tout le sel du jeu est dans le choix de la question : ni trop facile ni trop difficile. La règle retenue est que **la difficulté suit la valeur de la carte** :

| Rareté en jeu | Question | Pourquoi |
| --- | --- | --- |
| Commune, Peu commune | « De quel pays vient cette voiture ? » | La marque est visible et aide souvent (Lamborghini → Italie), mais les marques moins connues ou délocalisées gardent du piquant |
| Rare | « En quelle décennie est-elle sortie ? » (4 décennies consécutives) | Demande une vraie culture automobile ; le style de la voiture sur la photo donne des indices |
| Épique, Légendaire | « En quelle année est-elle sortie ? » (4 années à quelques années d'écart) | Les cartes les plus précieuses se méritent ; les voitures célèbres sont aussi celles dont on connaît la date |

Si une donnée manque (année inconnue…), la question se rabat sur la décennie puis sur le pays. En cas d'erreur, la bonne réponse est affichée.

## 🚪 Les 3 garages

> Trois portes de garage fermées. Laquelle ouvrir ?

- Derrière les trois portes, dans un ordre aléatoire :
  - **un garage vide** 💨 ;
  - **une carte standard** : Commune (70 %) ou Peu commune (30 %) ;
  - **une carte haut de gamme** : Épique (80 %) ou Légendaire (20 %).
- Le joueur touche une porte : elle se lève, puis **les deux autres s'ouvrent** pour montrer ce qu'il a manqué (ou évité).
- Chances par partie : 1 sur 3 de ne rien gagner, 1 sur 3 d'une carte standard, 1 sur 3 d'une Épique ou d'une Légendaire. C'est très généreux, d'où la limite de **2 parties par jour**.
- Succès associé : « Bonne porte » (trouver le gros lot).

## ⚔️ Duel de stats

> « Laquelle est la plus rapide ? »

- Deux voitures face à face et une question, à trancher d'un toucher.
- Questions possibles, selon les données disponibles :

  | Question | Critère |
  | --- | --- |
  | Laquelle est la plus rapide ? | Vitesse maximale |
  | Laquelle est la plus puissante ? | Puissance |
  | Laquelle est la plus lourde ? | Masse |
  | Laquelle est la plus longue ? | Longueur |
  | Laquelle est sortie en premier ? | Année de lancement |
  | Laquelle est la plus célèbre ? | Nombre de Wikipédias qui lui consacrent un article |

- Les deux voitures ont toujours un **écart suffisant** pour que la question soit équitable : au moins 6 % pour la vitesse, 8 % pour la masse, 3 ans pour l'année, etc. Il n'y a jamais d'égalité.
- Après la réponse, les deux valeurs sont révélées (« 408,5 km/h » contre « 305 km/h »).
- **10 manches maximum, la partie s'arrête à la première erreur.**
- **10 crédits** par bonne réponse, donc 100 crédits pour un 10/10, plus la carte bonus.

## 🧠 Quiz auto

> « De quel pays vient la Nissan Leaf ? »

- **5 questions à 4 choix.** La partie va jusqu'au bout, même en cas d'erreur.
- Types de questions :

  | Type | Exemple | Pièges |
  | --- | --- | --- |
  | Marque | « Quelle marque produit la "Countach" ? » | 3 autres marques du catalogue. Si le nom contient la marque, la question se pose sur la photo. |
  | Pays | « De quel pays vient la "Tata Nano" ? » | 3 autres pays du catalogue |
  | Décennie | « En quelle décennie la "Citroën DS" est-elle sortie ? » | Décennies voisines, présentées dans l'ordre chronologique |
  | Photo | « Quel est ce modèle ? » (photo seule) | 3 autres modèles, **de préférence de la même marque** |

- La question photo n'utilise que des photos stockées sur notre serveur : leur nom de fichier ne contient pas le nom du modèle, donc il ne trahit pas la réponse.
- **15 crédits** par bonne réponse, donc 75 crédits pour un 5/5, plus la carte bonus.

## Gains par jour

| Jeu | Maximum | En moyenne (estimation) |
| --- | --- | --- |
| Duel de stats (3 parties) | 300 🪙 + 3 cartes bonus | 60 à 120 🪙 |
| Quiz auto (3 parties) | 225 🪙 + 3 cartes bonus | 90 à 150 🪙 |
| Poids lourds (5 parties) | 5 cartes | 3 à 4 cartes |
| Question pour une carte (5 parties) | 5 cartes | 2 à 4 cartes |
| Les 3 garages (2 parties) | 2 cartes | 1,3 carte, dont 0,7 Épique ou Légendaire |

Les mini-jeux rapportent donc environ **7 à 10 cartes par jour** en plus des boosters (jusqu'à 48 boosters, soit 240 cartes par jour au maximum théorique, plutôt 75 à 125 en pratique). Ils complètent les boosters sans les remplacer.
