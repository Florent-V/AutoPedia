# 10. Application mobile

Le téléphone est la cible principale. Garage est une **PWA** (Progressive Web App) : un site web qui s'installe et se comporte comme une application, sans passer par les stores.

## Installation

| Appareil | Comment |
| --- | --- |
| Android (Chrome, Edge…) | Bouton « Installer » sur la page Boosters ou dans Profil > Application |
| iPhone / iPad (Safari) | Partager ⎋ puis « Sur l'écran d'accueil » (une aide s'affiche dans l'application) |
| Ordinateur (Chrome, Edge) | Icône d'installation dans la barre d'adresse, ou le bouton « Installer » |

Une fois installé, Garage s'ouvre en plein écran avec sa propre icône (la porte de garage), directement sur la page Boosters. Des raccourcis (appui long sur l'icône) mènent à « Ouvrir un booster » et « Ma collection ».

## Notifications

À activer dans **Profil > Application > Notifications** :

- **« Ta réserve est pleine 🎁 »** : envoyée une seule fois quand la réserve atteint 10 boosters. Aucune notification à chaque booster, pour ne pas déranger.
- **« Échange conclu 🤝 »** : quand une offre de bourse est acceptée.
- Un bouton « Tester » envoie une notification d'essai.

Sur iPhone, les notifications ne fonctionnent qu'une fois l'application **installée sur l'écran d'accueil** (iOS 16.4 ou plus récent). Elles exigent aussi que le site soit servi en HTTPS.

## Ergonomie mobile

- **Barre d'onglets en bas** (Boosters, Collection, Jeux, Marché, Profil), avec un badge qui affiche le nombre de boosters disponibles. Elle tient compte de l'encoche et de la barre de geste.
- **Révélation des cartes une par une** : on touche pour retourner, on glisse pour passer à la suivante, et le téléphone vibre sur les cartes rares (Android ; iOS ne permet pas la vibration web).
- Les notifications de succès apparaissent en haut de l'écran, en format compact.
- Filtres repliables, jauges qui défilent horizontalement, boutons larges pensés pour le pouce.

## Hors-ligne

L'interface et les photos de cartes déjà vues sont gardées en cache (jusqu'à 600 photos). Sans réseau, l'application s'ouvre et affiche les écrans visités, mais les actions de jeu (ouvrir un booster, jouer, acheter) demandent une connexion : l'état du jeu est toujours celui du serveur.
