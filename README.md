# 🌱 Bouture — plan interactif de la machine à boutures

Application web pour savoir **quelle graine se trouve dans quel trou** de la machine
à boutures hydroponique : un plan cliquable à l'image du bac, une légende de variétés
modifiable, et l'historique de tous les cycles déjà passés dans chaque trou.

Pensée pour être consultée et remplie depuis un smartphone, sur le réseau local.

## Ce que ça fait

- **Plan fidèle du bac** : 52 trous en quinconce, disposés comme sur la machine,
  avec le bouchon du réservoir au centre et un **symbole de lampe** à l'endroit du
  pied télescopique, qui sert de repère pour orienter le plan comme la vraie
  machine. Sur téléphone, le plan pivote automatiquement d'un quart de tour pour
  tenir dans l'écran.
- **Une couleur et un numéro par variété**, comme sur le plan papier.
- **Par trou** : variété, date de semis (avec le nombre de jours écoulés),
  statut (semé / germé / repiqué / raté) et note libre.
- **Remplissage rapide** : on choisit une variété dans la légende, puis chaque trou
  touché la reçoit — pratique pour remplir un bac entier en quelques secondes.
- **Historique** : vider un trou archive le cycle (variété, dates, issue) au lieu de
  l'effacer. L'historique reste consultable dans la fiche du trou.
- **Tours d'aquaponie** : une tour verticale est affichée en vue tournante, avec
  ses pots répartis autour de la colonne. On la fait tourner en la faisant glisser
  ou avec le curseur sous le schéma, et chaque pot se renseigne exactement comme
  un trou de bac (variété, date, statut, note, historique).
  Les **numéros de colonne flottent au-dessus de la tour** et suivent la rotation ;
  celui de la colonne qui fait face est mis en avant, de sorte qu'on sait toujours
  où l'on se trouve. Un étage sur deux étant décalé d'un demi-pas, il y a deux fois
  plus de colonnes que de pots par étage (8 colonnes pour 4 pots par étage), et
  chaque pot est repéré par « Étage 3 · colonne 5 ».
  On peut aussi **zoomer** pour s'approcher des pots (molette, pincement à deux
  doigts, ou les boutons − / +), et glisser verticalement une fois zoomé pour
  naviguer entre les étages ; un double-clic (ou double-tap) revient d'un coup à
  la vue d'ensemble.
- **Plusieurs bacs** : on peut ajouter d'autres bacs et tours, avec le même plan
  que la machine à boutures, une grille en quinconce sur mesure, une tour
  d'étages × pots au choix, ou la copie d'un existant.
- **Aucun login** : prévu pour un usage sur réseau local uniquement (voir Sécurité).
- **Thème clair/sombre** : le bouton ☀️/🌙/🌓 en haut à droite bascule entre
  clair, sombre et « suit l'appareil » (par défaut). Le choix est mémorisé
  sur l'appareil, indépendamment des réglages système.
- **Habillage** : palette kraft/vert vif/terre cuite, fond papier à grain
  léger, quelques icônes dessinées à la main (pousse, arrosoir, pot). Titres
  en sans-serif gras, sans fioriture — une première version avec police
  manuscrite, bordures perforées et éléments flottants en fond a été retirée
  après retour utilisateur (« ringard, années 90 »).
- **Guide des légumes** : une base de référence de plus de 50 légumes/aromates,
  intégrée à l'app (aucun appel réseau, aucune dépendance à un chatbot) —
  adaptation à une tour hydroponique, lumière, pH/EC indicatifs et jours
  jusqu'à maturité. Cherchable depuis le bouton **Guide** de la barre du haut,
  et directement utilisable pour semer : dans la fiche d'un trou, la loupe 🔍
  à côté du champ Variété ouvre le guide en mode sélection — choisir un légume
  crée (ou retrouve) automatiquement la variété correspondante dans la
  légende et l'assigne au trou. On peut marquer des légumes en **favori**
  (étoile) pour les retrouver en tête de liste sans avoir à chercher à chaque
  fois ; ce choix est mémorisé sur le serveur. Quand la variété d'un trou
  correspond à une fiche du guide, celle-ci s'affiche automatiquement dans
  la fiche du trou, avec une **estimation de la fenêtre de récolte** calculée
  à partir de la date de semis.

## Installation sur le serveur Ubuntu

Prérequis : Docker et le plugin Compose.

```bash
git clone https://github.com/MacGreg4000/Bouture.git && cd Bouture
```

```bash
cp .env.example .env
```

Édite `.env` pour choisir le mot de passe PostgreSQL (et le port si besoin), puis :

```bash
docker compose up -d --build
```

L'application est alors disponible sur **http://IP-DU-SERVEUR:8088**.
Le schéma de la base et le plan des 52 trous sont créés automatiquement au premier
démarrage — il n'y a aucune étape de migration à lancer à la main.

Vérifier que tout tourne :

```bash
docker compose ps && docker compose logs app --tail 20
```

### Mettre à jour

```bash
cd Bouture && git pull && docker compose up -d --build
```

Les données sont dans un volume Docker (`bouture_db-data`) : elles survivent aux
reconstructions et aux `docker compose down`. Seul `docker compose down -v`
les détruit.

### Sauvegarder / restaurer la base

```bash
docker compose exec -T db pg_dump -U bouture bouture > bouture-$(date +%F).sql
```

```bash
docker compose exec -T db psql -U bouture -d bouture < bouture-2026-07-25.sql
```

## Corriger le plan des trous

Tout le plan tient dans [`server/src/db/layout.js`](server/src/db/layout.js), dans le
tableau `ROWS` : une ligne par rangée du bac, avec le nombre d'emplacements (`slots`,
3 ou 4) et le numéro de variété de chaque emplacement (`null` = pas de trou à cet
endroit, c'est le bouchon du réservoir). La géométrie et la symétrie sont calculées
automatiquement — il n'y a aucune coordonnée à saisir.

Le repère de la lampe se règle juste en dessous, dans `DEFAULT_TRAY.lamp` : s'il
apparaît du mauvais côté du bac, passe `cy` à `100` et `dir` à `'down'`.

Après modification :

```bash
docker compose run --rm -e RESEED_LAYOUT=1 app node src/db/migrate.js && docker compose restart app
```

Le re-seed conserve les semis en cours et l'historique des trous déjà existants ;
seuls les trous supprimés du plan emportent leur historique.

## Étoffer le guide des légumes

Toute la base tient dans [`server/src/db/plants.js`](server/src/db/plants.js), dans
le tableau `PLANTS` : une entrée par légume/variante, avec `aliases` (les noms sous
lesquels une variété doit être reconnue, insensible aux accents/casse), la
catégorie, l'adaptation à une tour (`adapted` / `limited` / `not_recommended`),
lumière, pH/EC indicatifs et `daysMin`/`daysMax` (jours entre semis et première
récolte). Ajouter une entrée ne demande aucune migration : redémarrer le
conteneur `app` suffit (`docker compose restart app`).

Elle couvre aujourd'hui les *types* les plus courants au sein d'un même légume
(laitue Batavia / feuille de chêne / romaine…, tomate cerise / roma / naine /
grosse…) plutôt que des noms commerciaux précis de sachets de graines : au-delà
d'un certain niveau de détail, distinguer des cultivars exacts demanderait des
chiffres que je ne peux pas garantir exacts pour une référence commerciale
précise. Si une variété plus pointue te manque, ajoute-la directement dans le
fichier (ou demande, en précisant son nom et si possible ses caractéristiques
connues) — la correspondance par alias fera qu'elle sera reconnue dès que son
nom se rapproche d'une entrée existante, même sans ajout.

## Sécurité

L'application n'a **pas d'authentification** : n'importe qui pouvant joindre le port
8088 peut tout modifier. C'est volontaire pour un usage domestique sur réseau local
ou via VPN. **Ne l'expose pas directement sur Internet** en l'état — s'il faut y
accéder de l'extérieur, passe par un VPN (WireGuard, Tailscale) ou ajoute une
authentification devant (reverse proxy avec Basic Auth).

## Architecture

```
docker-compose.yml     PostgreSQL 16 + l'application Node
server/
  Dockerfile
  src/
    index.js           serveur Express (API + fichiers statiques)
    routes/api.js      toute l'API REST + validation des entrées
    db/pool.js         pool PostgreSQL, transactions, attente au démarrage
    db/schema.sql      schéma (idempotent, rejoué à chaque démarrage)
    db/migrate.js      création du schéma puis seed du plan et de la légende
    db/layout.js       LE PLAN DU BAC + la légende initiale
web/                   interface (HTML/CSS/JS natifs, aucune dépendance)
```

Modèle de données : `trays` (bacs) → `cells` (emplacements) → `plantings`
(un semis). Un `tray` a un `kind` : `tray` (bac à plat) ou `tower` (tour). Un
emplacement est repéré soit par `cx`/`cy` pour un bac à plat, soit par
`tier`/`slot` (étage et index du pot) pour une tour ; le reste de l'application
ne fait aucune différence entre les deux.

Une tour est dessinée en projection « tourne-disque », sans WebGL : les pots d'un
étage sont placés sur un cercle vu de trois quarts, et le `cos` de l'angle donne à
la fois le décalage vertical, la taille, l'opacité et l'ordre d'affichage — d'où
les pots qui passent derrière la colonne. Les réglages de perspective sont les
constantes `TOWER` en haut de [`web/app.js`](web/app.js) ; `tierH` doit rester
supérieur à `2 × ringRy + potH`, sinon les étages se télescopent.

Un emplacement peut avoir plusieurs `plantings` mais **un seul en cours** —
garanti par un index unique partiel sur `ended_on IS NULL`. Vider un trou ne supprime
rien : cela renseigne `ended_on` et `outcome`, ce qui constitue l'historique.

### API

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/api/state?tray=:id` | bacs, trous, semis en cours et légende en un appel |
| `POST` `PATCH` `DELETE` | `/api/trays[/:id]` | gérer les bacs |
| `GET` `POST` `PATCH` `DELETE` | `/api/varieties[/:id]` | gérer la légende |
| `PUT` | `/api/cells/:id/planting` | renseigner / modifier le semis d'un trou |
| `POST` | `/api/cells/:id/clear` | clôturer le cycle (passe à l'historique) |
| `GET` | `/api/cells/:id/history` | cycles terminés d'un trou |
| `GET` | `/api/plants` | guide des légumes (statique + favoris de l'utilisateur) |
| `PUT` `DELETE` | `/api/plants/:key/favorite` | marquer / retirer un favori |
| `GET` | `/healthz` | sonde de vie |

Supprimer une variété encore utilisée l'archive au lieu de l'effacer, pour ne pas
casser l'historique.

## Développement local

```bash
cp .env.example .env && APP_PORT=8089 docker compose up -d --build
```

Après une modification de `web/`, incrémente le `?v=` des balises `<link>` et
`<script>` dans `web/index.html` (cela force les navigateurs déjà ouverts à
recharger), puis `docker compose up -d --build app`.
