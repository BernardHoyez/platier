# platier

**Aide à l'interprétation de structures géologiques visibles sur l'estran.**

platier est une PWA 100 % statique (aucun serveur, aucune clé d'API) qui permet de :

1. délimiter un secteur d'étude sur l'estran (≤ 1500 m) ;
2. afficher sur ce seul secteur la BD Ortho IGN et le MNT LiDAR HD ombré, avec des réglages en direct ;
3. tracer des entités géologiques (silex, failles, etc.) dans des couches indépendantes ;
4. exporter la zone en **GeoPackage** ou **MBTiles** pour l'utiliser hors ligne (QGIS, applis de terrain…).

---

## 1. Déploiement sur GitHub Pages

1. Décompresser l'archive à la racine d'un dépôt (ou d'un sous-dossier) GitHub Pages, par exemple `BernardHoyez.github.io/platier/`.
2. Activer GitHub Pages sur le dépôt (branche `main`, dossier racine).
3. Ouvrir `https://<utilisateur>.github.io/platier/` en **HTTPS** (obligatoire pour le service worker et l'installation).
4. Sur mobile ou ordinateur : menu du navigateur → « Installer l'application » / « Ajouter à l'écran d'accueil ».

### Mettre à jour l'application (service worker brise-cache)

Le service worker (`sw.js`) est versionné par la constante `CACHE_NAME` (`platier-cache-v1`).
**À chaque modification d'un fichier de l'application, incrémenter ce numéro** (`v2`, `v3`…) avant de publier. À l'installation de la nouvelle version :

- le nouveau cache est créé (`skipWaiting`) ;
- à l'activation, **tous les anciens caches sont supprimés** et le nouveau service worker prend immédiatement le contrôle (`clients.claim`) ;
- la page se recharge automatiquement une fois (si une ancienne version était active) pour afficher la nouvelle version.

Stratégies de cache :

| Ressource | Stratégie |
|---|---|
| `index.html`, `style.css`, `app.js`, `manifest.json` et navigation | **Réseau d'abord** (requête sans cache HTTP), cache en secours hors ligne |
| Bibliothèques `vendor/`, icônes | Cache d'abord (pré-cachées à l'installation) |
| Tuiles IGN / OSM, services WMS-R | Non interceptées (toujours réseau) |

> Remarque : l'application elle-même démarre hors ligne, mais le MNT et les tuiles de la BD Ortho nécessitent une connexion pour être téléchargés (voir « Limites »).

---

## 2. Utilisation

L'interface comporte un panneau à gauche (en bas sur mobile) avec quatre étapes. Les étapes 2 à 4 sont grisées tant qu'un secteur n'est pas validé.

### Étape 1 · Zone d'étude

- **Fond de carte** : IGN Plan V2, IGN BD Ortho ou OpenStreetMap.
- **Tracer le secteur** : cliquer sur la carte pour poser les sommets du polygone, puis **Terminer** (minimum 3 sommets). **Effacer** annule le tracé en cours ou supprime la zone validée.
- **Contrainte de taille** : la plus grande distance entre deux sommets du polygone (« longueur ») doit être ≤ **1500 m**. Elle s'affiche en direct pendant le tracé ; au-delà, le secteur est refusé et il faut le retracer.
- **Largeur** : elle n'est pas contrôlée par l'application. Elle correspond à l'estran étendu, soit environ 100 m vers la terre et 100 m vers la mer à partir de la zone intertidale : c'est à l'opérateur d'ajuster le polygone en conséquence.

À la validation :

- le fond passe automatiquement sur la **BD Ortho** (le sélecteur de fond est alors verrouillé) ;
- tout ce qui est hors du secteur est masqué (voile sombre) et la carte est limitée à ses abords ;
- le MNT LiDAR HD de la zone est téléchargé puis ombré.

### Étape 2 · MNT LiDAR HD ombré

Le MNT (modèle numérique de terrain) est ombré par la méthode de Horn (pente et exposition sur fenêtre 3×3), avec un soleil à **45° de hauteur** fixe. Les curseurs agissent en direct :

| Curseur | Effet |
|---|---|
| **Opacité** (0–100 %) | Transparence de l'ombrage sur la BD Ortho |
| **Contraste** (0,2–3) | Amplifie ou réduit les écarts de gris autour du gris moyen |
| **Luminosité** (−100 à +100) | Éclaircit ou assombrit l'ensemble |
| **Azimut du soleil** (0–360°) | Direction d'éclairage (0° = nord, 90° = est, 315° = nord-ouest, classique) |
| **Exagération verticale** (1–20×) | Multiplie les dénivelés avant calcul de l'ombrage |
| **Zoom min / max** (13–19) | Bornes de zoom de la carte **et** plage de zooms de l'export |

### Étape 3 · Interprétation géologique

1. Saisir l'intitulé de l'entité (ex. `silex`, `faille`) puis **+ Couche**. La couche créée devient la couche active (en jaune dans la liste).
2. Choisir la **forme** (ligne ou polygone), la **couleur**, l'**épaisseur** et, pour un polygone, l'**opacité du remplissage**.
3. **Dessiner**, puis cliquer sur la carte pour poser les sommets ; **Terminer** valide la forme dans la couche active.
4. **Effacer** : supprime le dessin en cours ; s'il n'y en a pas, supprime la **dernière forme** de la couche active.
5. Dans la liste : cliquer sur le nom pour activer une couche, case à cocher pour l'afficher/masquer, `×` pour la supprimer avec toutes ses formes.

Chaque couche est indépendante. Seules les couches **visibles** sont exportées.

### Étape 4 · Export

Uniquement la zone restreinte (hors polygone, les tuiles sont noires en JPEG, transparentes en PNG).

- **Format** : GeoPackage (`.gpkg`) ou MBTiles (`.mbtiles`).
- **Vue exportée** :
  - *BD Ortho* ;
  - *MNT ombré* (avec les réglages courants de l'étape 2, y compris l'azimut et l'exagération) ;
  - *Géologie* (PNG transparent, formes seules) ;
  - *Synthèse* : empilement BD Ortho + MNT ombré + géologie avec **trois curseurs d'opacité** indépendants.
- **Tuiles PNG** : sans cette case, les tuiles sont en JPEG (plus léger, fond noir hors zone). Cochée, elles sont en PNG avec transparence hors zone. La vue *Géologie* est toujours en PNG.
- **Plage de zooms** : celle fixée par les curseurs *Zoom min / max* de l'étape 2.

Le fichier est téléchargé directement par le navigateur : `platier_<vue>_z<min>-<max>.gpkg` ou `.mbtiles`.

---

## 3. Formats d'export

Les deux formats contiennent des tuiles raster 256 × 256 px en projection **Web Mercator (EPSG:3857)**, schéma XYZ standard.

**MBTiles** (spécification 1.x)
- tables `metadata` (nom, format `png`/`jpg`, limites WGS 84, centre, zooms mini/maxi…) et `tiles` ;
- `tile_row` en numérotation TMS (inversée), comme l'exige la spécification.

**GeoPackage**
- tables standard `gpkg_spatial_ref_sys`, `gpkg_contents`, `gpkg_tile_matrix_set`, `gpkg_tile_matrix` ;
- table de tuiles `platier` (`zoom_level`, `tile_column`, `tile_row`, `tile_data`), `tile_row` en numérotation XYZ (depuis le haut), matrice mondiale EPSG:3857 ;
- les entités géologiques ne sont exportées qu'en tuiles raster (pas de tables vectorielles).

Ouverture : QGIS (glisser-déposer), applis de terrain compatibles MBTiles/GeoPackage raster.

---

## 4. Sources de données

| Donnée | Service |
|---|---|
| BD Ortho | Géoplateforme IGN, WMTS `ORTHOIMAGERY.ORTHOPHOTOS`, jeu de tuiles `PM_0_19` |
| Plan IGN v2 | Géoplateforme IGN, WMTS `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2` |
| MNT LiDAR HD | Géoplateforme IGN, WMS-R `IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93`, GeoTIFF 32 bits, EPSG:3857 |
| OpenStreetMap | `tile.openstreetmap.org` (respecter la politique d'usage des tuiles OSM) |

Données IGN © IGN ; fond OSM © contributeurs OpenStreetMap.

---

## 5. Fonctionnement technique

- **Aucune dépendance externe au chargement** : Leaflet 1.9.4, geotiff.js et sql.js (SQLite compilé en WebAssembly) sont fournis dans `vendor/`.
- **Téléchargement du MNT** : la boîte englobante du polygone (en Mercator) est découpée en requêtes WMS-R d'au plus 1000 × 1000 px, assemblées ensuite en une seule grille. La résolution est ~0,78 m (en Mercator) avec un plafond de 3000 px sur la plus grande dimension.
- **Valeurs aberrantes** : altitudes hors de −500…5000 m traitées comme « sans donnée » (transparentes dans l'ombrage).
- **Ombrage** : recalculé côté client à chaque mouvement de curseur (anti-rebond via `requestAnimationFrame`), affiché en `ImageOverlay` aligné sur la grille MNT. L'échelle horizontale utilise la correction `cos(latitude)` pour que l'exagération verticale soit cohérente.
- **Export** : pour chaque tuile couvrant la boîte englobante de la zone, un canvas 256 × 256 est composé (clip sur le polygone → BD Ortho → ombrage → tracés géologiques, chacun avec son opacité), encodé en JPEG ou PNG, puis inséré dans une base SQLite en mémoire exportée en fichier. Six tuiles sont traitées en parallèle.

### Structure du dépôt

```
platier/
├── index.html        interface
├── style.css         styles
├── app.js            logique (carte, MNT, ombrage, dessin, export)
├── sw.js             service worker brise-cache
├── manifest.json     manifeste PWA
├── icon-192.png / icon-512.png
└── vendor/           leaflet, geotiff.js, sql.js (+ .wasm)
```

---

## 6. Conseils de réglage

- **Faire ressortir micro-reliefs, fissures, failles** : exagération verticale **5 à 10×**, contraste **1,3 à 2**. Au-delà, le bruit du LiDAR devient visible.
- **Éviter de manquer une structure** : un ombrage ne révèle que les linéaments **perpendiculaires** à la direction d'éclairage. Faire varier l'**azimut** (par exemple 315°, 45°, 135°, 225°) et comparer.
- **Lecture sur l'orthophoto** : opacité du MNT entre **40 et 60 %** pour garder la lecture des teintes (algues, silex, estran humide) tout en voyant le relief.
- **Lecture du relief seul** : opacité 100 %, luminosité vers +10 à +20 si l'image est trop sombre.
- **Tracés visibles dans l'export** : privilégier une épaisseur de **3 à 5 px** et une couleur vive (rouge, jaune) ; en synthèse, une opacité géologie de **80–100 %** (à 50 % sur MNT sombre, les traits fins deviennent discrets).
- **Export synthèse** : exemple courant : ortho 100 %, MNT 40–50 %, géologie 100 %. Pour un fond de repérage sans ortho, mettre l'ortho à 0 % (le fond devient noir en JPEG, cocher PNG pour obtenir de la transparence).
- **Taille des fichiers** : chaque niveau de zoom supplémentaire multiplie le nombre de tuiles par ~4. Pour un usage terrain, une plage **16–19** est généralement suffisante ; **13–19** produit un fichier bien plus gros avec peu d'intérêt aux petits zooms sur une zone de 1,5 km.

---

## 7. Limites connues

- Le MNT et les tuiles de la BD Ortho (y compris pour l'export) nécessitent une connexion Internet : l'application ne met pas en cache les données IGN.
- Les couches géologiques ne sont **pas sauvegardées** entre deux sessions : exporter avant de fermer la page.
- L'export des entités en **vecteur** (tables GeoPackage) n'est pas implémenté.
- La longueur maximale est vérifiée par la plus grande distance entre sommets ; la largeur du polygone n'est pas contrôlée.
- L'altitude du soleil est fixe (45°).
- Le MNT LiDAR HD ne couvre pas nécessairement tout l'estran (zones recouvertes par la marée lors des levés) : les zones sans donnée apparaissent sans ombrage.

---

## 8. Dépannage

| Symptôme | Piste |
|---|---|
| « Échec MNT » | Vérifier la connexion ; zone hors couverture LiDAR HD ; service Géoplateforme momentanément indisponible. Retracer la zone pour relancer le téléchargement. |
| Tuiles BD Ortho vides à fort zoom | Jeu de tuiles `PM_0_19` : ne pas dépasser le zoom 19. |
| Ancienne version affichée après mise à jour | Vérifier que `CACHE_NAME` a bien été incrémenté dans `sw.js` ; recharger la page. |
| Export lent | Réduire la plage de zooms ; la BD Ortho est téléchargée tuile par tuile. |
| Export JPEG avec fond noir | Normal hors zone ; cocher « Tuiles PNG » pour la transparence. |
