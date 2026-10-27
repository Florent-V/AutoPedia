# 3. Authentification et sécurité

## Authentification : Better Auth

- **Méthode** : email et mot de passe (8 à 128 caractères), avec connexion automatique après l'inscription.
- **Mots de passe** : hachés par Better Auth (scrypt), stockés dans `account.password`.
- **Sessions** : stockées en base (table `session`), valables 30 jours et prolongées une fois par jour d'activité. Le cookie est `httpOnly`, `SameSite=Lax`, et `Secure` automatiquement si `BETTER_AUTH_URL` est en HTTPS. Un cache signé de 5 minutes (`cookieCache`) évite une lecture en base à chaque requête.
- **Montage** : le gestionnaire Better Auth est monté sur `/api/auth/*` **avant** l'analyse JSON de NestJS, car il lit lui-même le corps brut. Voir `apps/api/src/bootstrap.ts`.
- **Garde global** : `AuthGuard` (`apps/api/src/modules/identity/http/auth.guard.ts`) protège **toutes** les routes par défaut. Les routes publiques sont marquées explicitement `@Public()` : santé, clé publique push, et les deux routes d'administration du catalogue, protégées par jeton.
- **Côté front** : client `better-auth/vue`, et un middleware global qui redirige vers `/login` les pages protégées.

## Protection contre les abus

| Risque | Protection |
| --- | --- |
| Force brute sur la connexion | Limitation Better Auth : 10 tentatives par minute et par IP sur `/sign-in/email`, 5 inscriptions par minute sur `/sign-up/email`, 100 requêtes par minute sur le reste de `/api/auth` |
| IP falsifiée pour contourner la limitation | Le proxy Nuxt **écrase** `X-Forwarded-For` avec l'IP réelle de la connexion. Il ne fait confiance à l'en-tête entrant que si `TRUST_PROXY=true` (reverse proxy de confiance devant le site) |
| CSRF | Cookies `SameSite=Lax`, origines de confiance (`trustedOrigins` = `WEB_ORIGIN`), API sur la même origine. En plus, **toute action** (`POST`…) portant un en-tête `Origin` étranger ou `Sec-Fetch-Site: cross-site` est refusée (403, `shared/http/origin-check.ts`) |
| Affichage du site dans un cadre (clickjacking) | Le site Nuxt envoie `X-Frame-Options: DENY` et `Content-Security-Policy: frame-ancestors 'none'`, plus `nosniff`, `Referrer-Policy` et `Permissions-Policy` |
| Dépendances vulnérables | `npm audit` corrigé dans les deux applications (dont `sharp` 0.35.5, qui traite les images téléchargées, et `multer` forcé en 2.5). Reste un avertissement sur `deepmerge-ts`, utilisé uniquement par l'outil en ligne de commande de Prisma (lecture de sa configuration), jamais sur une donnée joueur |
| Base de données exposée | Port PostgreSQL publié uniquement sur `127.0.0.1` |
| Accès aux fichiers via `/api/media` | `express.static` avec `dotfiles: deny` ; les tentatives `../` renvoient 403 (vérifié) |
| Routes d'administration | En-tête `x-admin-token` comparé en temps constant ; désactivées si `ADMIN_TOKEN` fait moins de 16 caractères |
| Secrets | `BETTER_AUTH_SECRET` obligatoire en production ; graine de la boutique dérivée de ce secret ou définie par `SHOP_SECRET` |
| Entrées malformées ou enrichies | `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `forbidUnknownValues`) : **tout champ non prévu est refusé (400)**, on ne peut donc rien glisser de plus (prix, carte, gagnant…) dans une requête. Identifiants vérifiés (`ParseUUIDPipe`, `ParseIntPipe`, `ParseEnumPipe`), pagination bornée (page ≤ 10 000, 100 éléments au plus). Les objets-valeurs du domaine revalident les montants (`Credits` : entier, jamais négatif, plafonné) |
| Rafales de requêtes | `@nestjs/throttler` par joueur connecté (par IP sinon) : 20 requêtes par seconde et 300 par minute au plus (429 au-delà) |
| En-têtes HTTP | `helmet` : `Content-Security-Policy: default-src 'none'`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-site`, pas de `X-Powered-By` |
| Notifications vers une adresse interne (SSRF) | L'adresse d'abonnement push doit être en HTTPS, sans port ni identifiant, et viser un service de notification connu (Google, Mozilla, Apple, Microsoft ; `PUSH_ALLOWED_HOSTS` pour en changer) |
| Taille des requêtes | Corps JSON limité à 100 ko |

## Anti-triche

Le principe : **le client n'est jamais cru**. Toute règle de jeu est appliquée par le serveur.

| Fonction | Ce que le client ne peut pas faire |
| --- | --- |
| Boosters | Choisir ses cartes : le tirage se fait côté serveur, sous verrou. Ouvrir plus de boosters que la réserve : celle-ci est calculée à partir de l'heure du **serveur** |
| Mini-jeux | Connaître la réponse : elle reste dans `game_session.state` et la vue envoyée au client la retire (vérifié par test). Répondre deux fois à une manche : verrou sur la partie. Relancer une partie pour tomber sur une question plus facile : la partie active est reprise et toute partie commencée compte dans la limite du jour. Deviner à partir du nom de fichier de la photo : les fichiers sont nommés d'après le QID Wikidata |
| Boutique | Acheter une offre absente de la rotation en cours : l'offre est recalculée côté serveur. L'acheter deux fois : contrainte d'unicité. Payer moins cher : le prix est recalculé côté serveur |
| Bourse | Vendre une carte deux fois : séquestre. Accepter une offre deux fois : verrou et statut. Créer des crédits : la bourse ne fait que transférer, chaque mouvement est journalisé. Transférer ses biens depuis des comptes jetables : marché réservé aux comptes de plus de 24 h ayant ouvert 3 boosters, prix plancher par rareté, échanges limités à des raretés proches |
| Enchères | Enchérir sous le minimum, sur sa propre vente ou après la fin ; dépenser plus que son solde (les crédits sont bloqués dès l'offre) ; gonfler une vente avec un compte jetable (mêmes conditions d'accès que la bourse) |
| Récompense quotidienne | La réclamer deux fois ou fausser la série : dates calculées par l'horloge du serveur, sous verrou |
| Crédits | Les modifier : seules les règles du serveur écrivent `player.credits`, et chaque mouvement est enregistré dans `credit_transaction` |

Le détail complet, contrôle par contrôle, est dans [Architecture DDD : où sont faits les contrôles anti-triche](13-architecture.md#où-sont-faits-les-contrôles-anti-triche).

## Limites connues

- **Comptes multiples** : les garde-fous du marché rendent l'abus lent et coûteux, sans l'empêcher totalement. Un joueur patient peut encore préparer des comptes pendant plusieurs jours. Les étapes suivantes seraient la vérification de l'email (il faut un serveur d'envoi), une limite de comptes par adresse IP, ou la détection de transferts répétés entre les deux mêmes comptes.
- **Limitation de débit en mémoire** : avec plusieurs instances de l'API, il faudrait un stockage partagé (Redis).
- Un joueur peut chercher les réponses du quiz sur Internet. Aucun chronomètre n'est imposé pour l'instant (voir [Évolutions](11-evolutions.md)).

## Données personnelles

Le jeu ne stocke que le pseudo, l'email, le mot de passe haché, les sessions (avec l'IP et le navigateur, conservés par Better Auth) et les données de jeu. Seul le **pseudo** est visible des autres joueurs, sur les offres de la bourse. La suppression d'un compte supprime en cascade toutes ses données, y compris ses offres de bourse (et les cartes qu'elles tenaient en séquestre).
