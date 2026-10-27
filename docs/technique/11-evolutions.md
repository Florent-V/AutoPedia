# 11. Évolutions possibles

## Fonctionnelles

| Idée | Intérêt | Base existante |
| --- | --- | --- |
| **Amis** et échanges privés | Échanger entre proches, comparer les garages | `trade_offer` (ajouter un destinataire facultatif) |
| **Achat immédiat** sur les enchères | Vendre vite à un prix garanti | `auction` (ajouter `buyNowPrice`) |
| **Historique des prix** par carte | Aider à fixer ses prix | Tables `bid`, `trade_offer`, `shop_purchase` |
| **Profil public** et classement | Émulation, partage | `computePlayerStats` |
| **Recyclage des doublons** contre des crédits | Valoriser les doublons, nouveau puits/source | `CardsService.take` + `WalletService.credit` |
| **Boosters thématiques** (par pays, par décennie, 100 % course) | Variété, événements | `CatalogReader.randomCar` (ajouter des filtres) |
| **Défis quotidiens** (« obtiens une voiture japonaise ») | Raison de revenir chaque jour | Statistiques et succès |
| **Nouveaux mini-jeux** : « Plus ou moins » sur l'année, devinette de silhouette floutée, mémoire | Variété | `QuestionFactory` (`games/infrastructure/sql-question-factory.ts`) |
| **Chronomètre** dans le quiz | Limiter la recherche de réponses sur Internet | `game_session.state` |
| **Événements** (week-end double crédits, booster Légendaire offert) | Animation | `economyConfig` |
| **Connexion Google / Apple** | Inscription plus rapide | Plugins Better Auth |
| **Applications des stores** | Visibilité | Envelopper la PWA avec Capacitor |

## Techniques

| Sujet | Recommandation |
| --- | --- |
| **Plusieurs instances de l'API** | Déplacer les tâches de fond (notifications, médias, expirations) vers une file (BullMQ et Redis) ou un conteneur « worker » unique ; stocker la limitation de débit de Better Auth en base ou dans Redis |
| **Stockage des photos** | Passer à un stockage S3 (MinIO, Cloudflare R2) et servir via CDN quand le trafic grandit |
| **Tests d'intégration et CI** | Voir [Tests et qualité](10-tests-qualite.md) |
| **Observabilité** | Logs structurés (JSON), métriques (ouvertures, crédits créés et détruits par jour) pour piloter l'économie |
| **Administration** | Petit back-office : rareté forcée, désactivation de cartes, suivi de l'import, journal des crédits |
| **Montée de versions** | NestJS 12, Prisma 7+ (nouveau générateur), TypeScript 7 |
| **Crédits photo** | Afficher aussi l'attribution sur la carte en plein écran ; prévoir une page « Crédits et licences » |
