# API Symfony : FrankenPHP (Caddy + PHP) sert l'application ; le worker du Scheduler tourne dans le même conteneur.
FROM dunglas/frankenphp:1-php8.3-bookworm AS base
RUN install-php-extensions pdo_pgsql gd gmp intl opcache zip \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php.ini $PHP_INI_DIR/conf.d/zz-garage.ini
WORKDIR /app
ENV APP_ENV=prod APP_DEBUG=0 MEDIA_DIR=/data/media

FROM base AS build
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
# Plugins Composer actifs en root (symfony/runtime génère vendor/autoload_runtime.php).
ENV COMPOSER_ALLOW_SUPERUSER=1
COPY composer.json composer.lock symfony.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-progress
COPY . .
# Secret fictif le temps de la construction : le conteneur refuse de démarrer sans un vrai APP_SECRET.
RUN composer dump-autoload --classmap-authoritative --no-dev \
    && APP_SECRET=build-only-placeholder php bin/console cache:warmup

FROM base
COPY --from=build /app /app
COPY docker/entrypoint.sh /usr/local/bin/garage-entrypoint
# Utilisateur non-root : dossiers de Caddy, cache Symfony et photos (volume) lui appartiennent.
RUN chmod +x /usr/local/bin/garage-entrypoint \
    && mkdir -p /data/media \
    && chown -R www-data:www-data /data /config /app/var
USER www-data
EXPOSE 3001
ENTRYPOINT ["garage-entrypoint"]
# Serveur PHP de FrankenPHP : fichiers de public/, tout le reste vers le contrôleur frontal index.php.
CMD ["frankenphp", "php-server", "--root", "/app/public", "--listen", ":3001"]
