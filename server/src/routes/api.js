import { Router } from 'express';

import { query, withTransaction } from '../db/pool.js';
import { buildGrid, buildTower, DEFAULT_TRAY, HOLE_RADIUS, HOLES } from '../db/layout.js';

export const api = Router();

const STATUSES = ['seme', 'germe', 'repique', 'rate'];
const OUTCOMES = ['recolte', 'repique', 'rate', 'abandon'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (message) => new HttpError(400, message);
const notFound = (message) => new HttpError(404, message);

function cleanText(value, { max = 2000, field = 'valeur' } = {}) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw bad(`${field} : ${max} caractères maximum`);
  return text;
}

function cleanDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!DATE_RE.test(text) || Number.isNaN(Date.parse(text))) {
    throw bad(`${field} : date invalide (attendu AAAA-MM-JJ)`);
  }
  return text;
}

function cleanColor(value, fallback = '#6b7a8f') {
  if (!value) return fallback;
  const text = String(value).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(text)) throw bad('Couleur invalide (attendu #rrggbb)');
  return text.toLowerCase();
}

function cleanId(value, field) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) throw notFound(`${field} introuvable`);
  return id;
}

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ------------------------------------------------------------------ lecture */

async function loadTrayState(trayId) {
  const { rows: trays } = await query(
    `SELECT id, name, kind, view_box AS "viewBox", reservoir, lamp, tower
       FROM trays ORDER BY sort_order, id`,
  );
  if (!trays.length) return { trays: [], tray: null, cells: [] };

  const tray = trays.find((t) => t.id === trayId) ?? trays[0];

  const { rows: cells } = await query(
    `SELECT c.id,
            c.position,
            c.cx,
            c.cy,
            c.tier,
            c.slot,
            p.id            AS planting_id,
            p.variety_id,
            p.variety_label,
            p.variety_color,
            p.sown_on,
            p.status,
            p.note,
            (SELECT count(*)::int FROM plantings h
              WHERE h.cell_id = c.id AND h.ended_on IS NOT NULL) AS history_count
       FROM cells c
       LEFT JOIN plantings p ON p.cell_id = c.id AND p.ended_on IS NULL
      WHERE c.tray_id = $1
      ORDER BY c.position`,
    [tray.id],
  );

  return {
    trays,
    tray,
    cells: cells.map((row) => ({
      id: row.id,
      position: row.position,
      cx: row.cx,
      cy: row.cy,
      tier: row.tier,
      slot: row.slot,
      historyCount: row.history_count,
      planting: row.planting_id
        ? {
            id: row.planting_id,
            varietyId: row.variety_id,
            varietyLabel: row.variety_label,
            varietyColor: row.variety_color,
            sownOn: row.sown_on,
            status: row.status,
            note: row.note,
          }
        : null,
    })),
  };
}

async function loadVarieties() {
  const { rows } = await query(
    `SELECT v.id, v.number, v.name, v.color, v.archived,
            (SELECT count(*)::int FROM plantings p
              WHERE p.variety_id = v.id AND p.ended_on IS NULL) AS in_use
       FROM varieties v
      ORDER BY v.archived, coalesce(v.number, 9999), v.id`,
  );
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    name: r.name,
    color: r.color,
    archived: r.archived,
    inUse: r.in_use,
  }));
}

api.get(
  '/state',
  asyncRoute(async (req, res) => {
    const trayId = req.query.tray ? Number.parseInt(req.query.tray, 10) : null;
    const [state, varieties] = await Promise.all([loadTrayState(trayId), loadVarieties()]);
    res.json({ ...state, varieties, holeRadius: HOLE_RADIUS, statuses: STATUSES, outcomes: OUTCOMES });
  }),
);

/* --------------------------------------------------------------------- bacs */

api.post(
  '/trays',
  asyncRoute(async (req, res) => {
    const name = cleanText(req.body.name, { max: 80, field: 'Nom du bac' });
    if (!name) throw bad('Le nom du bac est obligatoire');

    const SOURCES = ['default', 'copy', 'grid', 'tower'];
    const source = SOURCES.includes(req.body.source) ? req.body.source : 'grid';
    const rows = Math.min(24, Math.max(1, Number.parseInt(req.body.rows, 10) || 6));
    const cols = Math.min(12, Math.max(2, Number.parseInt(req.body.cols, 10) || 4));
    const tiers = Math.min(30, Math.max(1, Number.parseInt(req.body.tiers, 10) || 10));
    const potsPerTier = Math.min(12, Math.max(2, Number.parseInt(req.body.potsPerTier, 10) || 4));

    const tray = await withTransaction(async (client) => {
      let holes;
      let viewBox = null;
      let reservoir = null;
      let lamp = null;
      let kind = 'tray';
      let tower = null;

      if (source === 'tower') {
        const built = buildTower(tiers, potsPerTier);
        holes = built.cells;
        tower = built.tower;
        kind = 'tower';
      } else if (source === 'default') {
        holes = HOLES.map((h) => ({ cx: h.cx, cy: h.cy }));
        viewBox = DEFAULT_TRAY.viewBox;
        reservoir = DEFAULT_TRAY.reservoir;
        lamp = DEFAULT_TRAY.lamp;
      } else if (source === 'copy') {
        const copyFrom = cleanId(req.body.copyFrom, 'Bac');
        const { rows: src } = await client.query(
          'SELECT kind, view_box, reservoir, lamp, tower FROM trays WHERE id = $1',
          [copyFrom],
        );
        if (!src.length) throw notFound('Bac à copier introuvable');
        const { rows: srcCells } = await client.query(
          'SELECT cx, cy, tier, slot FROM cells WHERE tray_id = $1 ORDER BY position',
          [copyFrom],
        );
        holes = srcCells;
        kind = src[0].kind;
        viewBox = src[0].view_box;
        reservoir = src[0].reservoir;
        lamp = src[0].lamp;
        tower = src[0].tower;
      } else {
        const grid = buildGrid(rows, cols);
        holes = grid.holes;
        viewBox = grid.viewBox;
      }

      const { rows: created } = await client.query(
        `INSERT INTO trays (name, kind, view_box, reservoir, lamp, tower, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, (SELECT coalesce(max(sort_order), 0) + 1 FROM trays))
         RETURNING id, name, kind, view_box AS "viewBox", reservoir, lamp, tower`,
        [name, kind, viewBox, reservoir, lamp, tower],
      );
      const trayId = created[0].id;

      for (const [index, hole] of holes.entries()) {
        await client.query(
          `INSERT INTO cells (tray_id, position, cx, cy, tier, slot)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [trayId, index + 1, hole.cx ?? null, hole.cy ?? null, hole.tier ?? null, hole.slot ?? null],
        );
      }
      return created[0];
    });

    res.status(201).json(tray);
  }),
);

api.patch(
  '/trays/:id',
  asyncRoute(async (req, res) => {
    const id = cleanId(req.params.id, 'Bac');
    const name = cleanText(req.body.name, { max: 80, field: 'Nom du bac' });
    if (!name) throw bad('Le nom du bac est obligatoire');
    const { rows } = await query(
      `UPDATE trays SET name = $2 WHERE id = $1
        RETURNING id, name, kind, view_box AS "viewBox", reservoir, lamp, tower`,
      [id, name],
    );
    if (!rows.length) throw notFound('Bac introuvable');
    res.json(rows[0]);
  }),
);

api.delete(
  '/trays/:id',
  asyncRoute(async (req, res) => {
    const id = cleanId(req.params.id, 'Bac');
    const { rows: count } = await query('SELECT count(*)::int AS n FROM trays');
    if (count[0].n <= 1) throw bad('Impossible de supprimer le dernier bac');
    const { rowCount } = await query('DELETE FROM trays WHERE id = $1', [id]);
    if (!rowCount) throw notFound('Bac introuvable');
    res.status(204).end();
  }),
);

/* ----------------------------------------------------------------- legende */

api.get(
  '/varieties',
  asyncRoute(async (_req, res) => {
    res.json(await loadVarieties());
  }),
);

api.post(
  '/varieties',
  asyncRoute(async (req, res) => {
    const name = cleanText(req.body.name, { max: 80, field: 'Nom de la variété' });
    if (!name) throw bad('Le nom de la variété est obligatoire');
    const color = cleanColor(req.body.color);
    const number =
      req.body.number === undefined || req.body.number === null || req.body.number === ''
        ? null
        : Number.parseInt(req.body.number, 10);
    if (number !== null && (!Number.isInteger(number) || number < 1 || number > 999)) {
      throw bad('Numéro de légende invalide (1 à 999)');
    }

    const { rows } = await query(
      `INSERT INTO varieties (number, name, color)
       VALUES (coalesce($1, (SELECT coalesce(max(number), 0) + 1 FROM varieties)), $2, $3)
       RETURNING id, number, name, color, archived`,
      [number, name, color],
    );
    res.status(201).json({ ...rows[0], inUse: 0 });
  }),
);

api.patch(
  '/varieties/:id',
  asyncRoute(async (req, res) => {
    const id = cleanId(req.params.id, 'Variété');
    const updated = await withTransaction(async (client) => {
      const { rows: current } = await client.query(
        'SELECT id, number, name, color, archived FROM varieties WHERE id = $1',
        [id],
      );
      if (!current.length) throw notFound('Variété introuvable');
      const v = current[0];

      const name = req.body.name === undefined ? v.name : cleanText(req.body.name, { max: 80, field: 'Nom de la variété' });
      if (!name) throw bad('Le nom de la variété est obligatoire');
      const color = req.body.color === undefined ? v.color : cleanColor(req.body.color, v.color);
      const archived = req.body.archived === undefined ? v.archived : Boolean(req.body.archived);
      let number = v.number;
      if (req.body.number !== undefined) {
        number =
          req.body.number === null || req.body.number === ''
            ? null
            : Number.parseInt(req.body.number, 10);
        if (number !== null && (!Number.isInteger(number) || number < 1 || number > 999)) {
          throw bad('Numéro de légende invalide (1 à 999)');
        }
      }

      const { rows } = await client.query(
        `UPDATE varieties SET number = $2, name = $3, color = $4, archived = $5
          WHERE id = $1
          RETURNING id, number, name, color, archived`,
        [id, number, name, color, archived],
      );

      // Les semis en cours suivent le renommage / la nouvelle couleur.
      await client.query(
        `UPDATE plantings SET variety_label = $2, variety_color = $3, updated_at = now()
          WHERE variety_id = $1 AND ended_on IS NULL`,
        [id, name, color],
      );
      return rows[0];
    });
    res.json(updated);
  }),
);

api.delete(
  '/varieties/:id',
  asyncRoute(async (req, res) => {
    const id = cleanId(req.params.id, 'Variété');
    const result = await withTransaction(async (client) => {
      const { rows: used } = await client.query(
        'SELECT count(*)::int AS n FROM plantings WHERE variety_id = $1',
        [id],
      );
      if (used[0].n > 0) {
        // On garde la variete (archivee) pour ne pas casser l'historique.
        const { rows } = await client.query(
          `UPDATE varieties SET archived = true WHERE id = $1
            RETURNING id, number, name, color, archived`,
          [id],
        );
        if (!rows.length) throw notFound('Variété introuvable');
        return { archived: true, variety: rows[0] };
      }
      const { rowCount } = await client.query('DELETE FROM varieties WHERE id = $1', [id]);
      if (!rowCount) throw notFound('Variété introuvable');
      return { archived: false };
    });
    res.json(result);
  }),
);

/* ------------------------------------------------------------------- trous */

async function currentPlanting(client, cellId) {
  const { rows } = await client.query(
    'SELECT * FROM plantings WHERE cell_id = $1 AND ended_on IS NULL',
    [cellId],
  );
  return rows[0] ?? null;
}

api.put(
  '/cells/:id/planting',
  asyncRoute(async (req, res) => {
    const cellId = cleanId(req.params.id, 'Trou');
    const status = req.body.status === undefined ? 'seme' : String(req.body.status);
    if (!STATUSES.includes(status)) throw bad(`Statut inconnu : ${status}`);
    const sownOn = cleanDate(req.body.sownOn, 'Date de semis');
    const note = cleanText(req.body.note, { max: 2000, field: 'Note' });

    const planting = await withTransaction(async (client) => {
      const { rows: cell } = await client.query('SELECT id FROM cells WHERE id = $1', [cellId]);
      if (!cell.length) throw notFound('Trou introuvable');

      let varietyId = null;
      let label = null;
      let color = null;
      if (req.body.varietyId !== undefined && req.body.varietyId !== null && req.body.varietyId !== '') {
        varietyId = cleanId(req.body.varietyId, 'Variété');
        const { rows: v } = await client.query(
          'SELECT id, name, color FROM varieties WHERE id = $1',
          [varietyId],
        );
        if (!v.length) throw notFound('Variété introuvable');
        label = v[0].name;
        color = v[0].color;
      }

      const existing = await currentPlanting(client, cellId);
      if (existing) {
        const { rows } = await client.query(
          `UPDATE plantings
              SET variety_id = $2, variety_label = $3, variety_color = $4,
                  sown_on = $5, status = $6, note = $7, updated_at = now()
            WHERE id = $1
            RETURNING *`,
          [existing.id, varietyId, label, color, sownOn, status, note],
        );
        return rows[0];
      }

      const { rows } = await client.query(
        `INSERT INTO plantings (cell_id, variety_id, variety_label, variety_color, sown_on, status, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [cellId, varietyId, label, color, sownOn, status, note],
      );
      return rows[0];
    });

    res.json({
      id: planting.id,
      varietyId: planting.variety_id,
      varietyLabel: planting.variety_label,
      varietyColor: planting.variety_color,
      sownOn: planting.sown_on,
      status: planting.status,
      note: planting.note,
    });
  }),
);

api.post(
  '/cells/:id/clear',
  asyncRoute(async (req, res) => {
    const cellId = cleanId(req.params.id, 'Trou');
    const outcome = req.body.outcome ? String(req.body.outcome) : 'abandon';
    if (!OUTCOMES.includes(outcome)) throw bad(`Issue inconnue : ${outcome}`);
    const endedOn = cleanDate(req.body.endedOn, "Date de fin") ?? new Date().toISOString().slice(0, 10);

    await withTransaction(async (client) => {
      const existing = await currentPlanting(client, cellId);
      if (!existing) throw bad('Ce trou est déjà vide');
      await client.query(
        'UPDATE plantings SET ended_on = $2, outcome = $3, updated_at = now() WHERE id = $1',
        [existing.id, endedOn, outcome],
      );
    });

    res.status(204).end();
  }),
);

api.get(
  '/cells/:id/history',
  asyncRoute(async (req, res) => {
    const cellId = cleanId(req.params.id, 'Trou');
    const { rows } = await query(
      `SELECT id, variety_label, variety_color, sown_on, status, note, ended_on, outcome
         FROM plantings
        WHERE cell_id = $1 AND ended_on IS NOT NULL
        ORDER BY ended_on DESC, id DESC`,
      [cellId],
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        varietyLabel: r.variety_label,
        varietyColor: r.variety_color,
        sownOn: r.sown_on,
        status: r.status,
        note: r.note,
        endedOn: r.ended_on,
        outcome: r.outcome,
      })),
    );
  }),
);

/* ---------------------------------------------------------------- erreurs */

api.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Erreur serveur' : err.message });
});
