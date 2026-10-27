# 6. Catalogue : import des données

Tout le contenu du jeu vient de sources libres de la fondation Wikimedia, et **tout est rapatrié localement** : données et résumés en base, photos dans `MEDIA_DIR`.

| Source | Licence | Ce qu'on en tire |
| --- | --- | --- |
| Wikidata (service SPARQL) | CC0 | Liste des voitures, caractéristiques, notoriété, photo de référence, titres d'articles |
| Wikimedia Commons (API) | Variable selon la photo (souvent CC BY-SA) | Miniatures, auteur et licence de chaque photo |
| Wikipédia (API) | CC BY-SA | Résumé d'introduction ; image principale pour le jeu de secours |

## Déroulé

```
import(source, limite)
 ├─ 1. Données
 │    ├─ wikidata : liste des voitures → détails par lots → upsert → raretés
 │    └─ en cas d'échec et de catalogue vide : jeu de secours (115 voitures)
 └─ 2. Médias (MediaService.syncAll)
      ├─ photos Commons des voitures Wikidata
      ├─ fichiers images des cartes de secours (via Wikipédia), puis leurs photos
      └─ résumés Wikipédia manquants
```

Déclenchement :

- **automatique** au premier démarrage, si le catalogue est vide (`CATALOG_AUTO_IMPORT=wikidata|seed|off`) ;
- **reprise des médias** à chaque démarrage et toutes les 6 heures (`MEDIA_SYNC_HOURS`) ;
- **à la main** : `node dist/cli/import-catalog [wikidata|seed|media|stats] [limite]` ;
- **à distance** : `POST /api/admin/catalog/import` (avec jeton d'administration).

## Étape 1 : la liste des voitures (Wikidata)

Deux familles, interrogées **séparément** :

- `Q3231690`, « modèle d'automobile », et ses sous-classes : voitures de série ;
- `Q90834785`, « modèle d'automobile de course », et ses sous-classes : F1, endurance, rallye. Dans Wikidata, ce n'est **pas** une sous-classe de la précédente : une requête sur la première seule oubliait toutes les voitures de course.

```sparql
SELECT ?car ?links ?img WHERE {
  ?class wdt:P279* wd:Q3231690 .
  ?car wdt:P31 ?class ; wikibase:sitelinks ?links ; wdt:P18 ?img .
  FILTER(?links >= 3)
}
```

On ne garde que les modèles **illustrés** (`P18`) et présents dans **au moins 3 Wikipédias**, ce qui écarte les fiches anecdotiques. Le tri par notoriété et la limite (`CATALOG_IMPORT_LIMIT`, 3 000 par défaut) sont appliqués **dans notre code** : une première version qui triait et regroupait côté Wikidata dépassait leur délai de 60 secondes (erreur 504). Dans nos tests, la requête sur les voitures de course a renvoyé 1 086 modèles en moins d'une seconde.

## Étape 2 : les détails (Wikidata, par lots de 50)

| Donnée | Propriétés Wikidata | Remarque |
| --- | --- | --- |
| Nom | libellé fr, sinon en | |
| Marque | `P1716` (marque), sinon `P176` (constructeur) | « Mercedes-Benz » plutôt que « Mercedes-Benz Group » |
| Pays | `P495`, sinon pays (`P17`) de la marque ou du constructeur | |
| Début | min(`P580`, `P571`, `P5204`, `P729`, `P577`) | Les années sont rangées sous des propriétés très variables d'une fiche à l'autre |
| Fin | max(`P582`, `P2669`, `P576`, `P730`) | |
| Puissance, vitesse, masse, longueur | `P2109`, `P2052`, `P2067`, `P2043` | Valeurs **normalisées** en unités SI (`psn:`), puis converties ; longueurs aberrantes filtrées |
| Notoriété | `wikibase:sitelinks` | Sert au calcul de la rareté |
| Articles | liens vers fr.wikipedia et en.wikipedia | Le français est préféré |
| Photo | `P18` → nom de fichier Commons | |

`upsertWikidata` crée ou met à jour chaque voiture (clé : `externalId` = QID). Deux cas particuliers :

- **Rattachement des cartes de secours** : une carte `seed:…` dont le titre Wikipédia fr correspond à un résultat Wikidata **prend son QID** au lieu d'être dupliquée. Les collections des joueurs sont conservées.
- **Photo changée** : si `imageFile` change, la copie locale et ses crédits sont réinitialisés pour être téléchargés de nouveau.

Les raretés sont ensuite recalculées (voir [Moteur de jeu](04-moteur-de-jeu.md#attribution-des-raretés-assignrarities)).

## Étape 3 : les photos (Commons)

`MediaService.syncImages` traite les voitures sans copie locale, par ordre de notoriété et **par lots de 50** :

1. Un appel `action=query&prop=imageinfo` sur commons.wikimedia.org renvoie, pour 50 fichiers d'un coup, l'URL d'une **miniature standard de 960 px** (taille préférée par Wikimedia, car déjà en cache chez eux) et les métadonnées `Artist`, `LicenseShortName` et `LicenseUrl`.
2. Pour chaque photo : téléchargement de la miniature, puis **sharp** (rotation EXIF, redimensionnement à 640 px, WebP qualité 78, environ 50 à 80 Ko), puis écriture de `cars/<QID>-<hash>.webp`.
3. Mise à jour de la carte : `imagePath`, auteur (HTML nettoyé), licence et URL de la licence.

Le nom de fichier contient le QID, et non le nom du modèle, pour ne pas trahir la réponse du quiz photo. Le suffixe de hachage change si la photo source change, ce qui invalide les caches.

**Cartes de secours** : elles n'ont pas de fichier Commons. `resolveSeedImageFiles` demande à Wikipédia l'image principale de leur article (`prop=pageimages`, par lots de 50), puis le même traitement s'applique.

## Étape 4 : les résumés (Wikipédia)

`syncSummaries` récupère l'introduction en texte brut (`prop=extracts&exintro&explaintext&exsentences=5`) **par lots de 20 articles**, groupés par langue. Si un résumé manque encore à l'affichage d'une fiche, il est récupéré à la volée (API REST, délai court) et mis en cache 30 jours.

## Politesse et robustesse (`catalog/infrastructure/wikimedia/http.ts`)

Wikimedia limite fortement les robots, surtout depuis les adresses IP de datacenter. Le client HTTP :

- envoie un **User-Agent identifiable** avec un contact (`WIKI_CONTACT`), comme l'exige leur politique ;
- respecte un **espacement minimal par domaine** : 1 s pour Wikidata, Commons et Wikipédia, 250 ms pour les miniatures ;
- en cas de **429, 502, 503 ou 504**, attend la durée indiquée par `Retry-After` (sinon un délai exponentiel), ralentit les requêtes suivantes vers ce domaine, et réessaie jusqu'à 5 ou 6 fois. Chaque attente est consignée dans les logs ;
- peut envoyer un **jeton Wikimedia** (`WIKIMEDIA_TOKEN`, facultatif) pour bénéficier de limites plus hautes.

**Reprise sur erreur** :

- une erreur **passagère** (403, 429, 5xx, réseau) **interrompt proprement** la synchronisation des médias, sans marquer les cartes en échec. Elle reprendra au prochain démarrage, dans 6 heures ou avec `import-catalog media` ;
- une erreur **définitive** sur une photo (404, image illisible) marque la carte (`imageCheckedAt`), qui ne sera retentée qu'au bout de 7 jours ;
- le jeu est **jouable dès l'étape 1**. En attendant sa photo locale, une carte affiche l'image distante (`MEDIA_REMOTE_FALLBACK=true`) ou le dessin technique.

## Suivi

```bash
docker compose logs -f api                                  # progression détaillée
docker compose exec api node dist/cli/import-catalog stats  # {"cards":3000,"withLocalImage":2140,"pendingImages":820,...}
curl -H "x-admin-token: $ADMIN_TOKEN" https://monsite/api/admin/catalog/status
```

## Jeu de secours

`apps/api/src/modules/catalog/infrastructure/seed-cars.ts` contient 115 voitures emblématiques (nom, marque, pays, années, notoriété estimée, titre Wikipédia). Il sert quand Wikidata est injoignable au premier démarrage, et pour les tests. Ces cartes sont rattachées automatiquement aux fiches Wikidata lors d'un import ultérieur.

## Ordres de grandeur

Pour 3 000 voitures : environ 60 requêtes Wikidata, 60 appels à l'API Commons et 3 000 téléchargements de miniatures (environ 200 Mo une fois converties). La durée dépend surtout de la tolérance de Wikimedia : quelques dizaines de minutes depuis une connexion classique, beaucoup plus depuis une IP de datacenter bridée.
