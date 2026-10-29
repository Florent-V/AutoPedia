# Garage : API Symfony

Seconde implémentation de l'API de Garage, en **PHP 8.3 / Symfony 7.4 LTS / Doctrine ORM 3**, fonctionnellement identique au backend NestJS (`apps/api`) : même schéma PostgreSQL, mêmes routes, mêmes réponses JSON, mêmes règles anti-triche. Le front Nuxt fonctionne avec l'un ou l'autre.

La comparaison détaillée des deux architectures (entités, contrôleurs, repositories, transactions, événements, tâches de fond, tests) est dans [`docs/technique/14-symfony-vs-nestjs.md`](../../docs/technique/14-symfony-vs-nestjs.md).

## Organisation

Un dossier par contexte métier, comme les modules NestJS :

```text
src/
├── Shared/          noyau : erreurs métier, Credits, aléatoire, calendrier du jeu, UnitOfWork,
│                    types Doctrine, écouteurs HTTP (Origin, débit, erreurs, JSON), Scheduler
├── Identity/        inscription, connexion, sessions (compatibles avec le contrat de Better Auth)
├── Player/          fiche joueur (entité avec objets embarqués), /me
├── Wallet/          crédits et journal
├── Catalog/         cartes, raretés, import Wikidata, photos et résumés, administration
├── Collection/      boosters, tirage, garanties, collection
├── Statistics/      statistiques d'un joueur
├── Progression/     succès, récompense quotidienne
├── Games/           mini-jeux
├── Marketplace/     boutique, bourse, enchères
├── Notifications/   Web Push
└── Bots/            joueurs automatiques
```

Dans chaque contexte : `Entity/` (agrégats Doctrine), `Domain/` (règles pures, objets-valeurs, ports), `Repository/`, `Service/` (cas d'usage et lectures), `Controller/`, `Dto/` (entrées validées), `Event/`, `EventListener/`, `Job/` (tâches planifiées), `Infrastructure/`, `Command/`.

## Démarrer en local

Prérequis : PHP 8.3 (extensions `pdo_pgsql`, `gd`, `intl`, `gmp`), Composer, PostgreSQL.

```bash
composer install
# .env contient des valeurs de développement ; surcharger dans .env.local (non versionné) si besoin
php bin/console doctrine:database:create --if-not-exists
php bin/console doctrine:migrations:migrate -n
php bin/console app:catalog:import seed            # jeu de secours (ou « wikidata »)
php -d variables_order=EGPCS -S 127.0.0.1:3001 -t public public/index.php
```

Tâches de fond (enchères, offres expirées, notifications, bots, photos), dans un autre terminal :

```bash
php bin/console messenger:consume scheduler_default
php bin/console debug:scheduler                    # programme et prochaines exécutions
```

Le front se branche dessus sans changement : `NUXT_API_BASE=http://localhost:3001 npm run dev` dans `apps/web`.

`variables_order=EGPCS` : le serveur intégré de PHP n'expose pas sinon les variables d'environnement à Symfony, qui reprendrait alors les valeurs de `.env`.

## Commandes utiles

| Commande | Rôle |
| --- | --- |
| `app:catalog:import [wikidata\|seed\|media\|stats] [limite] [--no-media] [--if-empty]` | Import du catalogue, rapatriement des médias |
| `app:bots:tick` | Un tour de boucle des bots (création, actions) |
| `debug:router` | Routes de l'API |
| `lint:container` | Vérifie le câblage des services |

## Tests

```bash
php vendor/bin/phpunit                 # 48 tests unitaires du domaine
cd ../api && npm run test:e2e:symfony  # la suite de bout en bout de NestJS, contre cette API
```

## Docker

```bash
# à la racine du dépôt, avec APP_SECRET défini dans .env (openssl rand -hex 32)
docker compose --profile symfony up -d --build
```

Le profil ajoute `api-symfony` (FrankenPHP, base `garage_symfony`) et un second front sur http://localhost:3002. Au démarrage, le conteneur applique les migrations, importe le catalogue s'il est vide et lance le worker du Scheduler.

## Configuration

Mêmes variables que le backend NestJS (voir [`docs/technique/09-deploiement-configuration.md`](../../docs/technique/09-deploiement-configuration.md)), avec leurs valeurs par défaut dans `config/services.yaml`. Propres à Symfony : `APP_SECRET` (obligatoire en production), `APP_ENV`, `DATABASE_URL` au format Doctrine (`…?serverVersion=16&charset=utf8`), `TRUSTED_PROXIES`, `LOCK_DSN`.
