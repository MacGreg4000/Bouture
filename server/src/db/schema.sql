-- Schema Bouture : idempotent, rejoue a chaque demarrage.

CREATE TABLE IF NOT EXISTS trays (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  view_box    text NOT NULL DEFAULT '-14 -14 224 128',
  reservoir   jsonb,                       -- {"cx":104,"cy":50,"r":13} ou NULL
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cells (
  id       serial PRIMARY KEY,
  tray_id  int  NOT NULL REFERENCES trays(id) ON DELETE CASCADE,
  position int  NOT NULL,                  -- numero du trou, 1..N
  cx       real NOT NULL,                  -- coordonnees dans le viewBox du bac
  cy       real NOT NULL,
  UNIQUE (tray_id, position)
);

CREATE INDEX IF NOT EXISTS cells_tray_idx ON cells (tray_id);

CREATE TABLE IF NOT EXISTS varieties (
  id         serial PRIMARY KEY,
  number     int,                          -- numero de legende (1..14 sur le plan papier)
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#6b7a8f',
  archived   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plantings (
  id            serial PRIMARY KEY,
  cell_id       int  NOT NULL REFERENCES cells(id) ON DELETE CASCADE,
  variety_id    int  REFERENCES varieties(id) ON DELETE SET NULL,
  variety_label text,                      -- copie du nom, pour que l'historique survive a une suppression
  variety_color text,
  sown_on       date,
  status        text NOT NULL DEFAULT 'seme',
  note          text,
  ended_on      date,                      -- NULL = occupation en cours
  outcome       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plantings_cell_idx ON plantings (cell_id);

-- Un seul semis "en cours" par trou.
CREATE UNIQUE INDEX IF NOT EXISTS plantings_one_current
  ON plantings (cell_id) WHERE ended_on IS NULL;
