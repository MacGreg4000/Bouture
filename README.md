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
- **Plusieurs bacs** : on peut ajouter d'autres bacs (tour hydroponie, 2ᵉ machine…),
  soit avec le même plan, soit avec une grille en quinconce sur mesure.
- **Aucun login** : prévu pour un usage sur réseau local uniquement (voir Sécurité).

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

Modèle de données : `trays` (bacs) → `cells` (trous, position fixe) → `plantings`
(un semis). Un trou peut avoir plusieurs `plantings` mais **un seul en cours** —
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
