# 3. Authentification et sécurité

## Authentification : Better Auth

- **Méthode** : email et mot de passe (8 à 128 caractères), avec connexion automatique après l'inscription.
- **Mots de passe** : hachés par Better Auth (scrypt), stockés dans `account.password`.
- **Sessions** : stockées en base (table `session`), valables 30 jours et prolongées une fois par jour d'activité. Le cookie est `httpOnly`, `SameSite=Lax`, et `Secure` automatiquement si `BETTER_AUTH_URL` est en HTTPS. Un cache signé de 5 minutes (`cookieCache`) évite une lecture en base à chaque requête.
- **Montage** : le gestionnaire Better Auth est monté sur `/api/auth/*` **avant** l'analyse JSON de NestJS, car il lit lui-même le corps brut. Voir `apps/api/src/main.ts`.
- **Garde global** : `AuthGuard` (`apps/api/src/auth/auth.guard.ts`) protège **toutes** les routes par défaut. Les routes publiques sont marquées explicitement `@Public()` : santé, clé publique push, et les deux routes d'administration du catalogue, protégées par jeton.
- **Côté front** : client `better-auth/vue`, et un middleware global qui redirige vers `/login` les pages protégées.

## Protection contre les abus

| Risque | Protection |
| --- | --- |
| Force brute sur la connexion | Limitation Better Auth : 10 tentatives par minute et par IP sur `/sign-in/email`, 5 inscriptions par minute sur `/sign-up/email`, 100 requêtes par minute sur le reste de `/api/auth` |
| IP falsifiée pour contourner la limitation | Le proxy Nuxt **écrase** `X-Forwarded-For` avec l'IP réelle de la connexion. Il ne fait confiance à l'en-tête entrant que si `TRUST_PROXY=true` (reverse proxy de confiance devant le site) |
| CSRF | Cookies `SameSite=Lax`, origines de confiance (`trustedOrigins` = `WEB_ORIGIN`), API sur la même origine |
| Base de données exposée | Port PostgreSQL publié uniquement sur `127.0.0.1` |
| Accès aux fichiers via `/api/media` | `express.static` avec `dotfiles: deny` ; les tentatives `../` renvoient 403 (vérifié) |
| Routes d'administration | En-tête `x-admin-token` comparé en temps constant ; désactivées si `ADMIN_TOKEN` fait moins de 16 caractères |
| Secrets | `BETTER_AUTH_SECRET` obligatoire en production ; graine de la boutique dérivée de ce secret ou définie par `SHOP_SECRET` |
| Entrées malformées | `ValidationPipe` global (`whitelist`, `transform`), identifiants vérifiés (`ParseUUIDPipe`, `ParseIntPipe`, `ParseEnumPipe`) |
| Taille des requêtes | Corps JSON limité à 100 ko |

## Anti-triche

Le principe : **le client n'est jamais cru**. Toute règle de jeu est appliquée par le serveur.

| Fonction | Ce que le client ne peut pas faire |
| --- | --- |
| Boosters | Choisir ses cartes : le tirage se fait côté serveur, sous verrou. Ouvrir plus de boosters que la réserve : celle-ci est calculée à partir de l'heure du **serveur** |
| Mini-jeux | Connaître la réponse : elle reste dans `game_session.state` et la vue envoyée au client la retire (vérifié par test). Répondre deux fois à une manche : verrou sur la partie. Relancer une partie pour tomber sur une question plus facile : la partie active est reprise et toute partie commencée compte dans la limite du jour. Deviner à partir du nom de fichier de la photo : les fichiers sont nommés d'après le QID Wikidata |
| Boutique | Acheter une offre absente de la rotation en cours : l'offre est recalculée côté serveur. L'acheter deux fois : contrainte d'unicité. Payer moins cher : le prix est recalculé côté serveur |
| Bourse | Vendre une carte deux fois : séquestre. Accepter une offre deux fois : verrou et statut. Créer des crédits : la bourse ne fait que transférer, chaque mouvement est journalisé |
| Crédits | Les modifier : seules les règles du serveur écrivent `player.credits`, et chaque mouvement est enregistré dans `credit_transaction` |

Limite assumée : un joueur peut chercher les réponses du quiz sur Internet. Aucun chronomètre n'est imposé pour l'instant (voir [Évolutions](11-evolutions.md)).

## Données personnelles

Le jeu ne stocke que le pseudo, l'email, le mot de passe haché, les sessions (avec l'IP et le navigateur, conservés par Better Auth) et les données de jeu. Seul le **pseudo** est visible des autres joueurs, sur les offres de la bourse. La suppression d'un compte supprime en cascade toutes ses données, y compris ses offres de bourse (et les cartes qu'elles tenaient en séquestre).
