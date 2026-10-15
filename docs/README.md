# Documentation de Garage

Garage est un jeu de collection de cartes sur le thème de l'automobile. Chaque carte est un vrai modèle de voiture (de série ou de course), avec ses données issues de Wikidata, sa photo de Wikimedia Commons et son résumé Wikipédia.

Cette documentation a deux volets :

- **Fonctionnel** : ce que vit le joueur, les règles du jeu et les choix de conception.
- **Technique** : comment c'est construit, pourquoi, et comment le faire tourner.

## Documentation fonctionnelle

| # | Sujet | Contenu |
| --- | --- | --- |
| 1 | [Présentation et parcours joueur](fonctionnel/01-presentation.md) | Concept, boucle de jeu, écrans, glossaire |
| 2 | [Boosters](fonctionnel/02-boosters.md) | Régénération, réserve, ouverture, garanties |
| 3 | [Cartes et raretés](fonctionnel/03-cartes-et-raretes.md) | Contenu d'une carte, attribution des raretés, probabilités chiffrées, points |
| 4 | [Collection](fonctionnel/04-collection.md) | Consultation, filtres, fiche d'une carte, doublons |
| 5 | [Succès et badges](fonctionnel/05-succes-et-badges.md) | Les 39 succès, les paliers, la vitrine |
| 6 | [Mini-jeux](fonctionnel/06-mini-jeux.md) | Poids lourds, Question pour une carte, Les 3 garages, Duel de stats, Quiz auto |
| 7 | [Crédits et économie](fonctionnel/07-credits-et-economie.md) | Sources et dépenses de crédits, équilibre |
| 8 | [Boutique](fonctionnel/08-boutique.md) | Programme quotidien, rotation horaire, prix, affaire de l'heure |
| 9 | [Bourse d'échanges](fonctionnel/09-bourse-echanges.md) | Offres, séquestre, acceptation, expiration |
| 10 | [Application mobile](fonctionnel/10-application-mobile.md) | Installation (PWA), notifications, hors-ligne |

## Documentation technique

| # | Sujet | Contenu |
| --- | --- | --- |
| 1 | [Architecture et choix techniques](technique/01-architecture.md) | Stack, organisation du dépôt, flux d'une requête, justification des choix |
| 2 | [Modèle de données](technique/02-modele-de-donnees.md) | Tables, relations, invariants |
| 3 | [Authentification et sécurité](technique/03-authentification-securite.md) | Better Auth, sessions, limitations de débit, anti-triche |
| 4 | [Moteur de jeu](technique/04-moteur-de-jeu.md) | Horloge des boosters, tirage, garanties, verrous |
| 5 | [Économie : implémentation](technique/05-economie-implementation.md) | Portefeuille, mini-jeux, rotation de la boutique, séquestre de la bourse |
| 6 | [Catalogue : import des données](technique/06-catalogue-import.md) | Wikidata, Commons, Wikipédia, politesse, reprise, raretés |
| 7 | [Référence de l'API](technique/07-api.md) | Toutes les routes |
| 8 | [Front-end](technique/08-front.md) | Nuxt, pages, composants, design des cartes, service worker |
| 9 | [Déploiement et configuration](technique/09-deploiement-configuration.md) | Docker, variables d'environnement, exploitation |
| 10 | [Tests et qualité](technique/10-tests-qualite.md) | Tests automatisés, vérifications manuelles |
| 11 | [Évolutions possibles](technique/11-evolutions.md) | Pistes et dette connue |
