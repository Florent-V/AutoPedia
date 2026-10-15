# 1. Présentation et parcours joueur

## Le concept

Garage reprend le principe de jeux comme Wiki-Masters ou TCGeo, appliqué aux voitures :

- toutes les 30 minutes, le joueur gagne un **booster**, et il peut en garder **10** en réserve ;
- chaque booster contient **5 cartes**, et chaque carte est un **vrai modèle de voiture** ;
- les cartes ont une **rareté**, qui dépend de la célébrité du modèle, et rapportent des **points de collection** ;
- le but est de **compléter son garage** : collectionner, débloquer des succès, et compléter ce que le hasard ne donne pas grâce aux mini-jeux, à la boutique et à la bourse d'échanges.

Le jeu se joue en solo, mais l'économie (crédits, bourse) relie déjà les joueurs entre eux.

## La boucle de jeu

```
           ┌──────────── toutes les 30 min ───────────┐
           ▼                                          │
   [Réserve de boosters] ──ouvrir──► [5 cartes] ──► [Collection]
                                                       │   ▲
   [Mini-jeux] ──crédits──► [Boutique] ──carte─────────┘   │
        │                                                  │
        └── sans-faute ──► carte bonus ────────────────────┤
                                                           │
   [Doublons] ──mise en bourse──► [Bourse] ◄──► autres joueurs
```

1. **Revenir régulièrement** : la réserve se remplit toute seule. Une notification prévient quand elle est pleine.
2. **Ouvrir ses boosters** : c'est la source principale de cartes.
3. **Jouer aux mini-jeux** : trois parties par jour et par jeu, pour gagner des crédits.
4. **Dépenser ses crédits** à la boutique, dont le contenu tourne toutes les heures.
5. **Échanger ses doublons** à la bourse contre des cartes manquantes ou des crédits.
6. **Débloquer des succès**, à afficher dans sa vitrine de badges.

## Les écrans

| Écran | Accès | Rôle |
| --- | --- | --- |
| Accueil | `/` | Présentation du jeu, inscription |
| Connexion / Inscription | `/login`, `/register` | Email + mot de passe |
| Boosters | `/boosters` (onglet 1) | Réserve, compte à rebours, garanties, ouverture |
| Collection | `/collection` (onglet 2) | Toutes les cartes du catalogue, possédées ou non |
| Jeux | `/games` (onglet 3) | Liste des mini-jeux et parties restantes |
| Partie | `/games/:id` | Déroulé d'une partie |
| Marché | `/market` (onglet 4) | Onglets Boutique et Bourse d'échanges |
| Profil | `/profile` (onglet 5) | Statistiques, crédits, vitrine de badges, réglages de l'application |
| Succès | `/achievements` | Tous les succès, avec leur progression |

Sur téléphone, la navigation se fait par une **barre d'onglets en bas d'écran**. Sur ordinateur, par la barre du haut. L'en-tête affiche toujours la réserve de boosters et le solde de crédits.

## Premier lancement d'un joueur

- **10 boosters** offerts (réserve pleine) ;
- **100 crédits** de bienvenue ;
- aucune carte : la collection montre tout le catalogue en silhouettes grises.

## Glossaire

| Terme | Définition |
| --- | --- |
| Booster | Paquet de 5 cartes tirées au hasard |
| Réserve | Nombre de boosters disponibles (10 au maximum) |
| Rareté | Commune, Peu commune, Rare, Épique, Légendaire |
| Carte vedette | 5ᵉ carte d'un booster, toujours au moins Peu commune |
| Garantie | Mécanisme qui assure une Épique au moins tous les 10 boosters et une Légendaire au moins tous les 60 |
| Points de collection | Somme des points des cartes **différentes** possédées |
| Crédits (🪙) | Monnaie du jeu, gagnée dans les mini-jeux et à la bourse |
| Offre | Carte proposée à la bourse contre une autre carte ou des crédits |
| Séquestre | Une carte proposée à la bourse est mise de côté jusqu'à l'échange ou l'annulation |
