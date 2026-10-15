# 6. Mini-jeux

Les mini-jeux sont la **source principale de crédits**. Ils mettent en valeur les données du catalogue : on apprend des choses sur les voitures en jouant.

## Règles communes

- **3 parties par jour et par jeu** (`GAMES_PER_DAY`). Le compteur repart à **minuit, heure de Paris** (`GAME_TIMEZONE`). La page Jeux affiche les parties restantes (pastilles vertes) et le temps avant les nouvelles parties.
- **Une partie commencée compte**, même abandonnée. Revenir sur le jeu **reprend la partie en cours**, dans l'heure qui suit : impossible de relancer une partie pour tomber sur des questions plus faciles. Passé ce délai, la partie est considérée comme abandonnée.
- Les **crédits sont gagnés à chaque bonne réponse**, immédiatement : abandonner en cours de route ne fait pas perdre ce qui est acquis.
- **Sans-faute = carte bonus** : réussir toutes les manches rapporte une carte tirée comme une carte vedette de booster (Peu commune ou mieux).
- Le **meilleur score** de chaque jeu est affiché.
- Toutes les réponses sont vérifiées par le serveur : voir [Sécurité](../technique/03-authentification-securite.md#anti-triche).

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

## Gains maximaux

| | Par partie | Par jour (3 parties) |
| --- | --- | --- |
| Duel de stats | 100 🪙 + 1 carte | 300 🪙 + 3 cartes |
| Quiz auto | 75 🪙 + 1 carte | 225 🪙 + 3 cartes |
| **Total** | | **525 🪙 + 6 cartes** au maximum |

En pratique, un joueur moyen gagne plutôt 150 à 300 crédits par jour.
