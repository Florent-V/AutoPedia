# 8. Front-end (Nuxt 4)

## Principes

- **Application monopage** (`ssr: false`). Nitro sert les fichiers statiques et le **proxy `/api`** (`server/routes/api/[...path].ts`).
- **Pas de bibliothèque d'interface** : CSS fait main avec des variables (`app/assets/css/main.css`) et des styles scopés par composant.
- **État global minimal** avec `useState` : session, joueur (`/me`), notifications à l'écran, état de la PWA.
- TypeScript strict, vérifié par `nuxt typecheck`.

## Pages

| Page | Fichier | Notes |
| --- | --- | --- |
| Accueil | `pages/index.vue` | Cartes de démonstration en éventail |
| Connexion / inscription | `pages/login.vue`, `register.vue` (via `AuthForm`) | Messages d'erreur Better Auth traduits |
| Boosters | `pages/boosters.vue` | Réserve, minuteur, garanties, invitation à installer l'application, ouverture |
| Collection | `pages/collection.vue` | Filtres repris dans l'adresse, pagination |
| Succès | `pages/achievements.vue` | Groupés par catégorie |
| Jeux | `pages/games/index.vue` | Parties restantes, remise à zéro |
| Partie | `pages/games/[id].vue` | Les 5 jeux : paires (Duel, Poids lourds), choix (Quiz, Question pour une carte), portes de garage animées (3 garages) ; repli sur le dessin technique si une image ne charge pas |
| Marché | `pages/market.vue` | Onglets `MarketShopTab` et `MarketTradesTab` |
| Profil | `pages/profile.vue` | Statistiques, crédits, vitrine de badges, réglages de l'application |

Le middleware `middleware/auth.global.ts` charge la session, redirige vers `/login` (en conservant la page demandée) et précharge `/me`.

## Composants clés

| Composant | Rôle |
| --- | --- |
| `CarCard` | La carte : cadre et fond par rareté, photo ou `CarLineArt`, trois caractéristiques, badge 🏁. **Holographie** pour les Épiques et les Légendaires : couche `repeating-linear-gradient` arc-en-ciel en `mix-blend-mode: color-dodge`, dont la position suit le pointeur (`--mx`, `--my`), et reflet radial. Inclinaison 3D par `rotateX/Y`. Toutes les tailles sont en unités `cqw` (`container queries`), donc la carte se met à l'échelle à n'importe quelle taille |
| `CarLineArt` | Dessin technique SVG (trois profils selon l'époque) |
| `CardBack` | Dos moderne : compte-tours SVG, trame, bord dégradé ; halo pulsant selon la rareté à venir |
| `BoosterPack` | Paquet aluminium : bande déchirable, reflet animé, logo |
| `BoosterOpening` / `MobileReveal` / `FlipCard` | Séquence d'ouverture ; sur mobile, une carte à la fois (toucher, glisser, vibration) |
| `CardModal` | Fiche détaillée, crédits photo, « Proposer à l'échange » |
| `market/ShopTab`, `TradesTab`, `TradeCreate`, `CardPicker` | Marché |
| `AppHeader`, `BottomNav`, `BoosterCounter` | Navigation (barre d'onglets à 5 entrées sur mobile) |
| `ToastHost` | Notifications à l'écran (en haut sur mobile, en bas à droite sur ordinateur) |
| `InstallCard`, `AppSettings` | Installation de la PWA et notifications |

## Composables

| Composable | Rôle |
| --- | --- |
| `api()` / `apiErrorMessage()` | `$fetch` vers `/api` ; un 401 redirige vers la connexion |
| `useAuthClient()`, `loadSession()`, `signOut()` | Better Auth |
| `usePlayerState()`, `refreshPlayer()`, `useBoosterTimer()` | État du joueur ; compte à rebours corrigé de l'écart avec l'horloge du serveur, rafraîchi quand un booster arrive |
| `useToasts()`, `notifyAchievements()`, `setCredits()` | Notifications et mise à jour du solde |
| `usePwa()`, `haptic()` | Installation, abonnement push, vibrations |

## PWA

- `public/manifest.webmanifest` : nom, icônes (dont une version *maskable*), `display: standalone`, raccourcis.
- `public/sw.js` (service worker, enregistré seulement en production) :
  - navigation : réseau d'abord, coquille en cache si hors-ligne ;
  - `/_nuxt/*`, icônes et polices : cache d'abord (fichiers versionnés) ;
  - `/api/media/*` : cache d'abord, dans un cache séparé limité à 600 photos ;
  - reste de `/api/*` : **jamais** mis en cache ;
  - événements `push` et `notificationclick` (ouvre ou ramène l'application sur la bonne page).
- Icônes générées à partir du logo SVG (`public/icons/`).

## Responsive

Point de rupture principal à 860 px. En dessous : barre d'onglets en bas, en-tête compact, filtres repliables. Les zones de sécurité iOS (`env(safe-area-inset-*)`) sont gérées partout où des éléments sont fixes. Testé en émulation iPhone et Pixel (390 × 844) : aucun débordement horizontal.
