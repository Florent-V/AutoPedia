# 5. Succès et badges

Les succès récompensent la progression dans toutes les dimensions du jeu. Chaque succès débloqué donne un **badge**, une médaille dont la couleur dépend du palier.

## Fonctionnement

- Chaque succès associe une **statistique** du joueur à un **objectif** (par exemple « boosters ouverts ≥ 50 »).
- Les succès sont vérifiés automatiquement après chaque action qui peut les faire progresser : ouverture d'un booster, fin d'une partie de mini-jeu (y compris une carte gagnée), achat en boutique, échange à la bourse. Pour un échange, la vérification se fait **pour les deux joueurs**.
- Un succès débloqué l'est définitivement, même si la statistique baisse ensuite (par exemple si le joueur donne des cartes).
- Le joueur est prévenu par une notification à l'écran.

## Paliers

| Palier | Médaille | Difficulté |
| --- | --- | --- |
| Bronze | cuivrée | Premiers pas, quelques jours de jeu |
| Argent | argentée | Joueur régulier |
| Or | dorée, avec halo | Joueur investi |
| Platine | bleu irisé, avec halo | Objectif au long cours |

## Où les voir

- **Page Succès** (`/achievements`, accessible depuis le profil) : tous les succès groupés par catégorie, avec une barre de progression (« 37/50 ») pour ceux qui restent à débloquer et la date d'obtention pour les autres.
- **Vitrine de badges** sur le profil : les badges obtenus.

## Liste des 39 succès


### Boosters

| Badge | Nom | Condition | Palier |
| --- | --- | --- | --- |
| 🎁 | Premier contact | Ouvrir votre premier booster | Bronze |
| 🔑 | Mise en route | Ouvrir 10 boosters | Bronze |
| ⚙️ | Rodage terminé | Ouvrir 50 boosters | Argent |
| 🛣️ | Grand tourisme | Ouvrir 200 boosters | Or |
| 🛞 | Million de kilomètres | Ouvrir 1 000 boosters | Platine |

### Collection

| Badge | Nom | Condition | Palier |
| --- | --- | --- | --- |
| 🏠 | Petit garage | Posséder 10 cartes différentes | Bronze |
| 🏪 | Concession | Posséder 50 cartes différentes | Bronze |
| 🅿️ | Parc automobile | Posséder 150 cartes différentes | Argent |
| 🏛️ | Musée de l’automobile | Posséder 500 cartes différentes | Or |
| 📚 | Encyclopédie vivante | Posséder 1 000 cartes différentes | Platine |
| 🚕 | Flotte de société | Posséder 5 exemplaires d’une même carte | Bronze |

### Rareté

| Badge | Nom | Condition | Palier |
| --- | --- | --- | --- |
| 💎 | Coup de chance | Obtenir une carte Rare | Bronze |
| 🔮 | Pièce de collection | Obtenir une carte Épique | Argent |
| 👑 | Légende vivante | Obtenir une carte Légendaire | Or |
| 🎩 | Salon privé | Posséder 10 cartes Épiques différentes | Or |
| 🏆 | Panthéon | Posséder 5 cartes Légendaires différentes | Platine |

### Exploration

| Badge | Nom | Condition | Palier |
| --- | --- | --- | --- |
| 🔧 | Fidèle à la marque | Posséder 5 cartes d’un même constructeur | Bronze |
| 🛠️ | Spécialiste | Posséder 15 cartes d’un même constructeur | Argent |
| 🗺️ | Tour d’Europe | Posséder des voitures de 5 pays différents | Bronze |
| 🌍 | Tour du monde | Posséder des voitures de 12 pays différents | Argent |
| 🏁 | Paddock | Posséder 5 voitures de course | Argent |
| 🏎️ | Écurie officielle | Posséder 20 voitures de course | Or |
| ⏳ | Voyage dans le temps | Posséder des voitures de 6 décennies différentes | Argent |

### Mini-jeux

| Badge | Nom | Condition | Palier |
| --- | --- | --- | --- |
| 🎮 | Échauffement | Terminer une partie de mini-jeu | Bronze |
| 🕹️ | Pilote d’essai | Terminer 25 parties de mini-jeux | Argent |
| 🧠 | Encyclopédiste | Terminer 100 parties de mini-jeux | Or |
| 🎴 | Butin | Gagner 10 cartes dans les mini-jeux | Bronze |
| 🏅 | Chasseur de trophées | Gagner 100 cartes dans les mini-jeux | Or |
| 🚪 | Bonne porte | Trouver la carte Épique ou Légendaire des 3 garages | Argent |
| 💰 | Tirelire | Gagner 1 000 crédits au total | Argent |
| 🏦 | Coffre-fort | Gagner 10 000 crédits au total | Or |

### Marché

| Badge | Nom | Condition | Palier |
| --- | --- | --- | --- |
| 🛒 | Premier achat | Acheter une carte à la boutique | Bronze |
| 🛍️ | Client fidèle | Acheter 10 cartes à la boutique | Argent |
| 🤝 | Poignée de main | Conclure un échange à la bourse | Bronze |
| 📈 | Négociant | Conclure 10 échanges à la bourse | Argent |
| 💼 | Courtier | Conclure 50 échanges à la bourse | Or |

### Score

| Badge | Nom | Condition | Palier |
| --- | --- | --- | --- |
| ⛽ | Plein d’essence | Atteindre 100 points de collection | Bronze |
| 🥇 | Pole position | Atteindre 1 000 points de collection | Argent |
| 🏎️ | Champion du monde | Atteindre 5 000 points de collection | Or |

## Ajouter un succès

Les succès sont déclarés dans `apps/api/src/achievements/achievements.definitions.ts`. Ajouter une ligne suffit, à condition que la statistique existe déjà (voir `PlayerStats` dans `apps/api/src/player/player-stats.ts`). La progression, le déblocage et l'affichage sont automatiques. Pour une nouvelle statistique, il faut l'ajouter au calcul de `computePlayerStats`.
