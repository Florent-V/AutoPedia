#!/bin/sh
# Démarrage du conteneur : base et migrations, import du catalogue s'il est vide, worker des tâches de fond, puis serveur.
set -e

if [ "$1" = 'frankenphp' ]; then
  php bin/console doctrine:database:create --if-not-exists --no-interaction
  php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration

  # Comme NestJS au démarrage : import en arrière-plan si le catalogue est vide, sinon reprise des photos.
  if [ "${CATALOG_AUTO_IMPORT:-wikidata}" != 'off' ]; then
    php bin/console app:catalog:import "${CATALOG_AUTO_IMPORT:-wikidata}" --if-empty &
  fi

  # Tâches planifiées (enchères, bourse, notifications, bots) ; relancé s'il s'arrête (limites de temps / mémoire).
  (while true; do
    php bin/console messenger:consume scheduler_default --time-limit=3600 --memory-limit=200M --quiet || sleep 5
  done) &
fi

exec docker-php-entrypoint "$@"
