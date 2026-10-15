# 10. Tests et qualité

## Tests automatisés

```bash
cd apps/api && npm test          # Jest
cd apps/api && npm run lint      # vérification TypeScript (tsc --noEmit)
cd apps/web && npx nuxt typecheck
```

| Fichier | Ce qui est vérifié |
| --- | --- |
| `game/booster-clock.spec.ts` | Régénération, plafond, démarrage du minuteur à l'ouverture depuis une réserve pleine, refus sans booster |
| `game/rarity.spec.ts` | Répartition du catalogue par notoriété, petits catalogues, carte vedette jamais Commune, garanties Épique et Légendaire, déclenchement au N-ième booster |
| `game/seeded.spec.ts` | Mélange déterministe, et bien une permutation |
| `game/zoned-time.spec.ts` | Début de journée et heure suivante à Paris, en heure d'été et d'hiver |
| `shop/shop-rotation.spec.ts` | Stabilité dans l'heure, changement à l'heure suivante, aucune Commune répétée dans la journée, Légendaires sur 4 heures, une seule affaire par heure |
| `catalog/media.spec.ts` | Extraction du nom de fichier Commons, nettoyage du HTML des auteurs |

## Vérifications réalisées pendant le développement

Ces scénarios ont été rejoués contre une vraie base PostgreSQL, en appelant l'API et en pilotant un navigateur Chromium en émulation mobile.

| Scénario | Résultat attendu, et obtenu |
| --- | --- |
| 12 ouvertures simultanées avec 9 boosters | 9 succès, 3 refus |
| 2 acceptations simultanées de la même offre | 1 succès, 1 refus (409) |
| 5 achats simultanés de la même offre en boutique | 1 succès, 4 refus, 1 seul débit au journal |
| Question de mini-jeu envoyée au client | Ne contient pas la réponse |
| Relance d'une partie en cours | La même partie est reprise |
| Réponse après la fin de partie / réponse invalide | 409 / 400 |
| Mise en bourse | La carte quitte la collection (séquestre) ; impossible de la proposer deux fois |
| Annulation / expiration d'une offre | La carte est rendue au vendeur |
| Accepter sa propre offre / une offre expirée | 400 / 409 |
| Achat sans crédits suffisants / offre d'une heure passée | 409 / 404 |
| Notification « réserve pleine » | Envoyée une seule fois ; abonnement invalide supprimé |
| `/api/media/../.env` | 403 |
| Parcours mobile complet (inscription, booster, jeux, boutique, bourse à deux joueurs) | Aucune erreur, aucun débordement horizontal |
| Simulation de 300 000 boosters | Probabilités conformes, garanties respectées (voir [Cartes et raretés](../fonctionnel/03-cartes-et-raretes.md)) |

## Ce qui n'a pas pu être vérifié dans l'environnement de développement

- **Construction des images Docker** : pas de démon Docker disponible. La configuration est validée par `docker compose config`, mais les images n'ont jamais été construites.
- **Téléchargement réel des photos** : l'adresse IP de l'environnement de développement (un datacenter) est bloquée par Wikimedia (`thumb.wikimedia.org` et `upload.wikimedia.org`). La chaîne conversion → stockage → service → crédits a été validée avec une image de test ; l'import Wikidata des données et l'API Commons ont été validés en conditions réelles.
- **Appareils réels** : l'installation de la PWA et la réception des notifications sur un vrai téléphone.

## Pistes pour aller plus loin

- Tests d'intégration automatisés (Jest + base PostgreSQL éphémère) reprenant les scénarios ci-dessus.
- Tests de bout en bout Playwright dans la CI.
- Intégration continue GitHub Actions : lint, tests et construction des images.
