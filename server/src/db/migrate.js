import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { pool, withTransaction } from './pool.js';
import { DEFAULT_TRAY, HOLES, VARIETIES } from './layout.js';

const here = dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const schema = await readFile(join(here, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('[db] schema a jour');
}

/**
 * Cree le bac par defaut + la legende, uniquement si la base est vierge.
 * RESEED_LAYOUT=1 force la recreation des trous du bac par defaut
 * (les semis en cours et l'historique sont conserves quand le nombre de trous
 *  ne change pas ; sinon les trous supprimes emportent leur historique).
 */
export async function seed() {
  await withTransaction(async (client) => {
    const { rows: varietyRows } = await client.query('SELECT count(*)::int AS n FROM varieties');
    if (varietyRows[0].n === 0) {
      for (const v of VARIETIES) {
        await client.query(
          'INSERT INTO varieties (number, name, color) VALUES ($1, $2, $3)',
          [v.number, v.name, v.color],
        );
      }
      console.log(`[db] legende initialisee (${VARIETIES.length} varietes)`);
    }

    const { rows: trayRows } = await client.query(
      'SELECT id FROM trays ORDER BY sort_order, id LIMIT 1',
    );
    const force = process.env.RESEED_LAYOUT === '1';
    let trayId = trayRows[0]?.id ?? null;

    if (trayId && !force) return;

    if (!trayId) {
      const { rows } = await client.query(
        'INSERT INTO trays (name, view_box, reservoir, sort_order) VALUES ($1, $2, $3, 0) RETURNING id',
        [DEFAULT_TRAY.name, DEFAULT_TRAY.viewBox, DEFAULT_TRAY.reservoir],
      );
      trayId = rows[0].id;
    } else {
      await client.query('UPDATE trays SET view_box = $2, reservoir = $3 WHERE id = $1', [
        trayId,
        DEFAULT_TRAY.viewBox,
        DEFAULT_TRAY.reservoir,
      ]);
      await client.query('DELETE FROM cells WHERE tray_id = $1 AND position > $2', [
        trayId,
        HOLES.length,
      ]);
    }

    const varieties = new Map();
    const { rows: allVarieties } = await client.query(
      'SELECT id, number, name, color FROM varieties WHERE number IS NOT NULL',
    );
    for (const v of allVarieties) varieties.set(v.number, v);

    for (const [index, hole] of HOLES.entries()) {
      const position = index + 1;
      const { rows } = await client.query(
        `INSERT INTO cells (tray_id, position, cx, cy)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tray_id, position) DO UPDATE SET cx = EXCLUDED.cx, cy = EXCLUDED.cy
         RETURNING id`,
        [trayId, position, hole.cx, hole.cy],
      );
      const cellId = rows[0].id;

      if (!hole.v) continue;
      const variety = varieties.get(hole.v);
      if (!variety) continue;

      // Ne pre-remplit que les trous encore jamais utilises.
      const { rows: existing } = await client.query(
        'SELECT 1 FROM plantings WHERE cell_id = $1 LIMIT 1',
        [cellId],
      );
      if (existing.length) continue;

      await client.query(
        `INSERT INTO plantings (cell_id, variety_id, variety_label, variety_color, status)
         VALUES ($1, $2, $3, $4, 'seme')`,
        [cellId, variety.id, variety.name, variety.color],
      );
    }

    console.log(`[db] bac "${DEFAULT_TRAY.name}" pret (${HOLES.length} trous)`);
  });
}

// Permet de rejouer migration + seed a la main :
//   docker compose run --rm app node src/db/migrate.js
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  const { waitForDatabase } = await import('./pool.js');
  await waitForDatabase();
  await migrate();
  await seed();
  await pool.end();
}
