# 7. Crédits et économie

Les **crédits (🪙)** sont la monnaie du jeu. Le solde est affiché en permanence dans l'en-tête, et l'historique des derniers mouvements se trouve sur le profil.

## D'où viennent les crédits (sources)

| Source | Montant | Limite |
| --- | --- | --- |
| Bonus de bienvenue | 100 | une fois, à l'inscription (`STARTING_CREDITS`) |
| Duel de stats | 10 par bonne réponse | 3 parties par jour |
| Quiz auto | 15 par bonne réponse | 3 parties par jour |
| Vente à la bourse | prix fixé par le vendeur | payé par un autre joueur |

## Où partent les crédits (dépenses)

| Dépense | Montant |
| --- | --- |
| Boutique | de 40 à 4 000 selon la rareté (voir [Boutique](08-boutique.md)) |
| Achat à la bourse | prix fixé par le vendeur |

## Principes d'équilibre

- **Création monétaire limitée** : les seules sources de crédits « neufs » sont le bonus de bienvenue et les deux jeux à crédits, plafonnés par le nombre de parties par jour (525 crédits par jour au maximum). Les jeux rapides donnent des **cartes**, pas de crédits : ils n'alimentent pas l'inflation. Les échanges de la bourse ne font que **déplacer** des crédits entre joueurs, sans en créer.
- **La boutique est le puits principal** : les crédits dépensés disparaissent. L'inflation reste ainsi contenue.
- **Les prix suivent la rareté** : une Commune coûte 40 crédits (une partie de duel moyenne), une Légendaire 4 000 crédits (environ deux semaines de jeu assidu). La boutique permet de **cibler** une rareté sans court-circuiter les boosters.
- **La boutique donne des repères de prix à la bourse** : quand un joueur crée une offre contre des crédits, le prix proposé par défaut est d'environ 75 % du prix boutique de la rareté (30, 90, 300, 900, 3 000). C'est cohérent : la bourse permet de choisir sa carte précise, la boutique non.

## Journal des mouvements

Chaque mouvement est enregistré : date, montant, motif (« Duel de stats », « Achat en boutique », « Vente à la bourse »…), objet concerné et solde après opération. Le joueur voit ses 8 derniers mouvements sur son profil. Ce journal sert aussi d'outil d'audit en cas de litige ou de suspicion de triche.

## Leviers de réglage

Tous ces paramètres se règlent sans toucher au code : `STARTING_CREDITS`, `GAMES_PER_DAY`, gains par bonne réponse (`economyConfig` dans `apps/api/src/config.ts`), prix de la boutique (`SHOP_RULES` dans `apps/api/src/shop/shop-rotation.ts`).
