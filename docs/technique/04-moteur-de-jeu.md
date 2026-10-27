# 4. Moteur de jeu

La logique de jeu est faite d'**agrégats** et de **fonctions pures** (couches `domain/` des contextes `collection` et `catalog`), couvertes par des tests unitaires. Les services ne font qu'orchestrer : verrous, lecture, appel des règles, écriture.

## Horloge des boosters (`collection/domain/booster-clock.ts`, agrégat `BoosterReserve`)

Aucune tâche planifiée ne distribue les boosters. L'état stocké se résume à **deux valeurs** :

- `boosters` : le nombre de boosters à l'instant de l'ancre ;
- `boosterAnchor` : le point de départ du minuteur.

À chaque lecture, `computeBoosters(state, now, max, regenMs)` calcule l'état courant :

```
si boosters ≥ max      → réserve pleine, minuteur figé (ancre = maintenant)
sinon
  gagnés = ⌊(maintenant − ancre) / intervalle⌋
  si boosters + gagnés ≥ max → plein, ancre = maintenant
  sinon boosters += gagnés ; ancre += gagnés × intervalle   (conserve la fraction entamée)
prochainBooster = ancre + intervalle
```

`consumeBooster(status, now)` retire un booster. Si la réserve était pleine, le minuteur démarre à cet instant. Sinon, l'ancre reste inchangée et le temps déjà écoulé n'est pas perdu.

Avantages : aucun cron, aucune dérive, et un résultat exact même après des semaines d'absence. Le front reçoit `nextAt` et l'heure du serveur, et calcule l'écart d'horloge pour afficher un compte à rebours juste.

## Tirage (`catalog/domain/rarity.ts`, `collection/domain/booster-draw.ts`)

1. `rollBoosterRarities(5, random, pity)` tire une rareté par emplacement :
   - emplacements 1 à 4 : poids `dropWeight` (62 / 26 / 9 / 2,5 / 0,5) ;
   - emplacement 5 (vedette) : poids `featuredWeight` (0 / 55 / 33 / 9,5 / 2,5).
2. **Garantie** : `pityFor(sinceEpic, sinceLegendary, 10, 60)` indique si ce booster doit contenir une Épique ou une Légendaire. Si le tirage ne la contient pas déjà, la carte vedette est remplacée : par une Légendaire si la garantie Légendaire est active, sinon par une Épique (80 %) ou une Légendaire (20 %).
3. Pour chaque rareté tirée, `CatalogReader.randomCar` choisit une voiture au hasard (`ORDER BY random()`) parmi les cartes actives de cette rareté, en excluant celles déjà tirées dans le booster. S'il n'y en a pas, il se rabat sur la rareté la plus proche. Les doublons ne sont autorisés qu'en dernier recours, pour les tout petits catalogues.
4. Les compteurs `sinceEpic` et `sinceLegendary` sont remis à zéro ou incrémentés selon le résultat.

L'aléatoire du tirage utilise `Math.random()` côté serveur. Un aléatoire cryptographique n'apporterait rien ici : le client ne voit jamais l'état du générateur.

## Attribution des raretés (`assignRarities`)

Après chaque import, `CatalogService.recomputeRarities()` trie les cartes actives par `popularity` décroissante, puis découpe la liste : 2 % Légendaire, 6 % Épique, 15 % Rare, 27 % Peu commune, 50 % Commune. Chaque tranche prend au moins une carte tant qu'il en reste : même un catalogue minuscule a au moins une Légendaire. En revanche, avec seulement trois cartes, seules les trois raretés les plus élevées sont représentées. Une carte avec `rarityOverride` garde sa rareté forcée, car `COALESCE(rarityOverride, rarity)` est appliqué partout.

## Ouverture d'un booster (`BoostersService.open`)

Tout se passe dans **une seule transaction** :

1. `SELECT … FOR UPDATE` sur la ligne `player` : les ouvertures simultanées sont traitées l'une après l'autre (testé : 12 requêtes parallèles avec 9 boosters donnent 9 succès et 3 refus « aucun booster »).
2. Calcul de la réserve, puis refus (409) si elle est vide.
3. Tirage avec garantie.
4. Mise à jour de `player` : réserve, ancre, compteurs, garanties.
5. Ajout des cartes (`CardsService.grant`) et historique (`booster_opening`). Les raretés sont tirées avec un aléatoire cryptographique (`crypto.randomInt`).
6. Calcul des statistiques et évaluation des succès.
7. Réponse : cartes (avec `isNew` et `quantity`), nouvel état de la réserve, statistiques, nouveaux succès, garantie appliquée.

## Statistiques et succès

`computePlayerStats` calcule en **deux requêtes SQL** toutes les statistiques du joueur : cartes uniques, points, nombre par rareté, voitures de course, pays et décennies distincts, maximum par marque et maximum d'exemplaires. S'y ajoutent les compteurs de `player`. `AchievementsService.evaluate` compare ces statistiques aux définitions et insère les nouveaux succès (`createMany … skipDuplicates`).
