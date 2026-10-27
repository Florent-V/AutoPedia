# Garage 🏎️

Jeu de collection de cartes sur le thème de l'automobile, pensé d'abord pour le mobile (PWA). Chaque carte est un vrai modèle de voiture, de série ou de course, avec ses données issues de **Wikidata**, sa photo de **Wikimedia Commons** et son résumé **Wikipédia**.

- 🎁 **Boosters** : un nouveau toutes les 30 minutes, 10 en réserve au maximum, 5 cartes chacun ; une Épique garantie au plus tard tous les 10 boosters, une Légendaire tous les 60.
- 💎 **5 raretés** calculées d'après la notoriété du modèle ; les Épiques et les Légendaires sont holographiques.
- 📚 **Collection** filtrable, avec une fiche détaillée par carte et les crédits des photos.
- 🏆 **45 succès** en quatre paliers, qui rapportent des crédits, et un **calendrier de récompenses** sur 7 jours consécutifs.
- 🎮 **5 mini-jeux** : des jeux rapides où l'on gagne une carte (Poids lourds, Question pour une carte, Les 3 garages) et des jeux à crédits (Duel de stats, Quiz auto).
- 🛒 **Boutique** dont le contenu tourne toutes les heures, avec une « affaire de l'heure ».
- 🤝 **Bourse d'échanges** ouverte à tous : carte contre carte ou contre crédits, avec séquestre.
- 🔨 **Enchères** : crédits bloqués à chaque offre, remboursement automatique en cas de surenchère, prolongation contre les offres de dernière seconde.
- 🤖 **Bots** signalés comme tels, qui ouvrent leurs boosters, enchérissent et échangent pour animer le marché au lancement.
- 📱 **Application installable**, avec des notifications quand la réserve de boosters est pleine.

## Stack

NestJS 11 · Prisma 6 · PostgreSQL 17 · Better Auth · Nuxt 4 (Vue 3) · Docker Compose

## Démarrage rapide

```bash
cp .env.example .env     # renseigner BETTER_AUTH_SECRET et WIKI_CONTACT
docker compose up -d --build
```

Ouvrir ensuite http://localhost:3000. Le catalogue s'importe automatiquement au premier démarrage : d'abord les données, puis les photos et les résumés en arrière-plan.

## Documentation

La documentation complète est dans [`docs/`](docs/README.md) :

- **Fonctionnelle** : [parcours joueur](docs/fonctionnel/01-presentation.md), [boosters](docs/fonctionnel/02-boosters.md), [cartes et raretés](docs/fonctionnel/03-cartes-et-raretes.md), [collection](docs/fonctionnel/04-collection.md), [succès](docs/fonctionnel/05-succes-et-badges.md), [mini-jeux](docs/fonctionnel/06-mini-jeux.md), [crédits](docs/fonctionnel/07-credits-et-economie.md), [boutique](docs/fonctionnel/08-boutique.md), [bourse](docs/fonctionnel/09-bourse-echanges.md), [application mobile](docs/fonctionnel/10-application-mobile.md), [enchères](docs/fonctionnel/11-encheres.md), [récompenses](docs/fonctionnel/12-recompenses.md), [bots](docs/fonctionnel/13-bots.md)
- **Technique** : [architecture](docs/technique/01-architecture.md), [modèle de données](docs/technique/02-modele-de-donnees.md), [sécurité](docs/technique/03-authentification-securite.md), [moteur de jeu](docs/technique/04-moteur-de-jeu.md), [économie](docs/technique/05-economie-implementation.md), [import du catalogue](docs/technique/06-catalogue-import.md), [API](docs/technique/07-api.md), [front-end](docs/technique/08-front.md), [déploiement et configuration](docs/technique/09-deploiement-configuration.md), [tests](docs/technique/10-tests-qualite.md), [évolutions](docs/technique/11-evolutions.md), [bots](docs/technique/12-bots.md), [architecture DDD et anti-triche](docs/technique/13-architecture.md)
