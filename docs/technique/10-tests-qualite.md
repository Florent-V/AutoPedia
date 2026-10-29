# 10. Tests et qualité

## Tests automatisés

```bash
cd apps/api && npm test          # Jest (tests unitaires)
cd apps/api && npm run test:e2e  # tests de bout en bout : vraie API + base PostgreSQL temporaire
cd apps/api && npm run test:e2e:symfony  # la même suite, contre l'API Symfony
cd apps/api-symfony && php vendor/bin/phpunit  # tests unitaires PHP (domaine)
cd apps/api && npm run lint      # vérification TypeScript (tsc --noEmit)
cd apps/web && npx nuxt typecheck
```

| Fichier | Ce qui est vérifié |
| --- | --- |
| `shared/domain/credits.spec.ts` | Montants refusés (négatifs, décimaux, démesurés), solde jamais négatif, plafond |
| `shared/infrastructure/system.spec.ts` | Aléatoire cryptographique dans [0, 1[ |
| `wallet/domain/wallet.spec.ts` | Journal avec solde résultant, débit refusé sans effet de bord, montants invalides |
| `collection/domain/booster-reserve.spec.ts` | Réserve vide refusée, régénération avant ouverture, garanties remises à zéro, boosters offerts au-delà du maximum |
| `games/domain/game-session.spec.ts` | Aucun champ secret dans la vue, fin au premier faux pas, bonus de sans-faute, réponses hors format, cartes gagnées, portes |
| `marketplace/domain/auction.spec.ts` | Mise en vente validée, offre minimale, surenchère sur soi-même, prolongation, annulation, règlement et commission |
| `marketplace/domain/market-policy.spec.ts` | Marché fermé aux comptes récents ou inactifs (sauf bots), prix plancher, échanges trop déséquilibrés |
| `marketplace/domain/trade-offer.spec.ts` | Contrepartie unique, prix bornés, acceptation unique et non expirée, retrait par le vendeur seulement |
| `progression/domain/daily-streak.spec.ts` | Une réclamation par jour, série continue et cycle de 7 jours, série remise à 1 |
| `notifications/domain/push-endpoint.spec.ts` | Adresses de notification limitées aux services connus (anti-SSRF) |
| `collection/domain/booster-clock.spec.ts` | Régénération, plafond, démarrage du minuteur à l'ouverture depuis une réserve pleine, refus sans booster |
| `catalog/domain/rarity.spec.ts` + `collection/domain/booster-draw.spec.ts` | Répartition du catalogue par notoriété, petits catalogues, carte vedette jamais Commune, garanties Épique et Légendaire, déclenchement au N-ième booster |
| `shared/domain/seeded.spec.ts` | Mélange déterministe, et bien une permutation |
| `shared/domain/zoned-time.spec.ts` | Début de journée et heure suivante à Paris, en heure d'été et d'hiver |
| `marketplace/domain/shop-rotation.spec.ts` | Stabilité dans l'heure, changement à l'heure suivante, aucune Commune répétée dans la journée, Légendaires sur 4 heures, une seule affaire par heure |
| `catalog/application/media-sync.spec.ts` | Extraction du nom de fichier Commons, nettoyage du HTML des auteurs |
| `bots/domain/bot-brain.spec.ts` | Valeur estimée (carte manquante, doublons, marque fétiche), jamais d'offre au-delà de la valeur, pas d'offre systématique, échanges équitables uniquement |

Les tests de bout en bout (`test/e2e/`) rejouent automatiquement les scénarios métier et anti-triche ci-dessous : voir [Architecture DDD](13-architecture.md#tests-de-bout-en-bout). Ils passent aussi contre l'API Symfony (`E2E_BACKEND=symfony`), dont les tests unitaires PHPUnit reprennent ceux de ce tableau et vérifient en plus que la boutique et le générateur pseudo-aléatoire donnent exactement les mêmes résultats qu'en Node : voir [la comparaison des deux backends](14-symfony-vs-nestjs.md#tests).

## Vérifications réalisées pendant le développement

Ces scénarios ont été rejoués contre une vraie base PostgreSQL, en appelant l'API et en pilotant un navigateur Chromium en émulation mobile.

| Scénario | Résultat attendu, et obtenu |
| --- | --- |
| 12 ouvertures simultanées avec 9 boosters | 9 succès, 3 refus |
| 2 acceptations simultanées de la même offre | 1 succès, 1 refus (409) |
| 5 achats simultanés de la même offre en boutique | 1 succès, 4 refus, 1 seul débit au journal |
| Question de mini-jeu envoyée au client | Ne contient pas la réponse |
| Relance d'une partie en cours | La même partie est reprise |
| Jeux rapides (Poids lourds, Question pour une carte, 3 garages) | Ni la réponse, ni la carte en jeu, ni le contenu des portes ne sont envoyés avant la réponse ; la carte gagnée est en collection ; limites de 5, 5 et 2 parties par jour respectées |
| Réponse après la fin de partie / réponse invalide | 409 / 400 |
| Mise en bourse | La carte quitte la collection (séquestre) ; impossible de la proposer deux fois |
| Annulation / expiration d'une offre | La carte est rendue au vendeur |
| Accepter sa propre offre / une offre expirée | 400 / 409 |
| Achat sans crédits suffisants / offre d'une heure passée | 409 / 404 |
| Notification « réserve pleine » | Envoyée une seule fois ; abonnement invalide supprimé |
| `/api/media/../.env` | 403 |
| Enchères | Offre minimale, refus de surenchérir sur soi-même, remboursement exact du surenchéri, prolongation à 2 min, annulation refusée après une offre, règlement (carte au gagnant, montant − 5 % au vendeur), annulation sans offre |
| Récompense quotidienne | Jour 1 versé, 2ᵉ réclamation refusée (409), jour 7 = carte Épique + succès de série payés, boosters offerts au-delà de 10 |
| Bots | 12 bots créés avec personnalités ; ils ouvrent leurs boosters, réclament leur récompense, enchérissent sur les ventes d'un joueur (deux Rares mises à prix 5 montées à 237 et 303), acceptent une offre de bourse, mettent leurs doublons en vente |
| Écran Marché > Enchères, calendrier de récompenses, badges 🤖 (mobile) | Aucune erreur, aucun débordement |
| Parcours mobile complet (inscription, booster, jeux, boutique, bourse à deux joueurs) | Aucune erreur, aucun débordement horizontal |
| Simulation de 300 000 boosters | Probabilités conformes, garanties respectées (voir [Cartes et raretés](../fonctionnel/03-cartes-et-raretes.md)) |

## Ce qui n'a pas pu être vérifié dans l'environnement de développement

- **Construction des images Docker** : pas de démon Docker disponible. La configuration est validée par `docker compose config`, mais les images n'ont jamais été construites.
- **Téléchargement réel des photos** : l'adresse IP de l'environnement de développement (un datacenter) est bloquée par Wikimedia (`thumb.wikimedia.org` et `upload.wikimedia.org`). La chaîne conversion → stockage → service → crédits a été validée avec une image de test ; l'import Wikidata des données et l'API Commons ont été validés en conditions réelles.
- **Appareils réels** : l'installation de la PWA et la réception des notifications sur un vrai téléphone.

## Pistes pour aller plus loin

- Tests de bout en bout Playwright dans la CI.
- Intégration continue GitHub Actions : lint, tests et construction des images.
