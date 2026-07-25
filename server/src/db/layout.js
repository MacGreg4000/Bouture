/**
 * Plan de la machine a boutures, releve sur la photo du bac vue de dessus.
 *
 * Structure reelle : 16 rangees en quinconce, alternant 3 et 4 trous, en
 * miroir autour du bouchon du reservoir. Les deux rangees centrales (8 et 9)
 * sont des rangees de 4 dont les 2 trous du milieu sont occupes par le
 * bouchon -> il reste 2 trous de chaque cote.
 *
 *   rangees  1 -> 8 : 3, 4, 3, 4, 3, 4, 3, 4
 *   rangees  9 -> 16: 4, 3, 4, 3, 4, 3, 4, 3   (miroir des precedentes)
 *   total : 24 + 2 + 2 + 24 = 52 trous
 *
 * Repere : bac vu de dessus, en paysage. cy = 0..100 sur la largeur.
 *
 * ---------------------------------------------------------------------------
 * CORRIGER LE PLAN : tout se passe dans ROWS ci-dessous.
 *   - `slots` = 3 ou 4, le nombre d'emplacements de la rangee (la geometrie
 *     et la symetrie sont calculees automatiquement) ;
 *   - `v` = un numero de variete par emplacement, dans l'ordre de la largeur ;
 *   - `null` = emplacement sans trou (bouchon du reservoir) ;
 *   - `0` = trou present mais laisse vide au demarrage.
 * Puis rejoue le plan sur le serveur :
 *   docker compose run --rm -e RESEED_LAYOUT=1 app node src/db/migrate.js
 *   docker compose restart app
 * ---------------------------------------------------------------------------
 */

export const HOLE_RADIUS = 7.2;

const IN_ROW_STEP = 80 / 3; // ecart entre 2 trous d'une meme rangee
const ROW_STEP = 14.9; // ecart entre 2 rangees
const ROW_X0 = 10; // position de la premiere rangee
const MIDDLE_EXTRA = 8.1; // sur-ecartement des 2 rangees centrales (bouchon)
const MIDDLE_ROW = 8; // index (base 0) de la premiere rangee d'apres le bouchon

// Positions en largeur, centrees sur 50 et decalees d'un demi-pas entre les
// deux types de rangees : c'est ce decalage qui produit le quinconce.
const SLOT_CY = {
  3: [50 - IN_ROW_STEP, 50, 50 + IN_ROW_STEP],
  4: [50 - 1.5 * IN_ROW_STEP, 50 - 0.5 * IN_ROW_STEP, 50 + 0.5 * IN_ROW_STEP, 50 + 1.5 * IN_ROW_STEP],
};

const ROWS = [
  { slots: 3, v: [1, 1, 1] },
  { slots: 4, v: [1, 1, 1, 2] },
  { slots: 3, v: [3, 3, 3] },
  { slots: 4, v: [4, 4, 4, 4] },
  { slots: 3, v: [5, 5, 5] },
  { slots: 4, v: [5, 5, 5, 5] },
  { slots: 3, v: [6, 6, 6] },
  { slots: 4, v: [2, null, null, 2] }, // bouchon du reservoir
  { slots: 4, v: [2, null, null, 2] }, // bouchon du reservoir
  { slots: 3, v: [7, 7, 8] },
  { slots: 4, v: [9, 9, 9, 8] },
  { slots: 3, v: [10, 10, 10] },
  { slots: 4, v: [11, 11, 11, 11] },
  { slots: 3, v: [12, 12, 12] },
  { slots: 4, v: [13, 13, 13, 13] },
  { slots: 3, v: [14, 14, 14] },
];

const rowCx = (index) => ROW_X0 + index * ROW_STEP + (index >= MIDDLE_ROW ? MIDDLE_EXTRA : 0);

function buildHoles() {
  const holes = [];
  for (const [index, row] of ROWS.entries()) {
    const positions = SLOT_CY[row.slots];
    if (!positions) throw new Error(`Rangee ${index + 1} : slots doit valoir 3 ou 4`);
    if (row.v.length !== row.slots) {
      throw new Error(
        `Rangee ${index + 1} : ${row.v.length} valeurs pour ${row.slots} emplacements`,
      );
    }
    for (const [slot, variety] of row.v.entries()) {
      if (variety === null) continue; // pas de trou a cet emplacement
      holes.push({ cx: rowCx(index), cy: positions[slot], v: variety || null });
    }
  }
  return holes;
}

export const HOLES = buildHoles();

// Bouchon centre entre les 2 rangees du milieu, au milieu de la largeur.
const RESERVOIR_CX = Number(((rowCx(MIDDLE_ROW - 1) + rowCx(MIDDLE_ROW)) / 2).toFixed(2));

export const DEFAULT_TRAY = {
  name: 'Machine à boutures',
  viewBox: '-6 -6 264 112',
  reservoir: { cx: RESERVOIR_CX, cy: 50, r: 16.8 },
  /**
   * Pied telescopique de la lampe : sert de repere pour orienter le plan comme
   * la vraie machine. Il arrive sur le bord long, a hauteur du reservoir.
   * `dir` = le sens dans lequel le pied sort du bac.
   * Si le repere se retrouve du mauvais cote, passer cy a 100 et dir a 'down'.
   */
  lamp: { cx: RESERVOIR_CX, cy: 0, dir: 'up' },
};

// La legende du plan papier. Modifiable ensuite directement depuis l'interface.
export const VARIETIES = [
  { number: 1, name: 'Concombre', color: '#2f9e44' },
  { number: 2, name: 'Radis', color: '#e64980' },
  { number: 3, name: 'Tomate cerise', color: '#e03131' },
  { number: 4, name: 'Lombardie pepper', color: '#f59f00' },
  { number: 5, name: 'Laitue', color: '#94d82d' },
  { number: 6, name: 'Poireau', color: '#0ca678' },
  { number: 7, name: 'Chou rouge', color: '#9c36b5' },
  { number: 8, name: 'Chou de Bruxelles', color: '#5c940d' },
  { number: 9, name: 'Chou-fleur', color: '#adb5bd' },
  { number: 10, name: 'Brocoli', color: '#087f5b' },
  { number: 11, name: 'Salade romaine', color: '#7048e8' },
  { number: 12, name: 'Roquette', color: '#12b886' },
  { number: 13, name: 'Iceberg', color: '#4dabf7' },
  { number: 14, name: 'Carotte', color: '#fd7e14' },
];

/**
 * Genere un plan en quinconce regulier pour un nouveau bac cree depuis l'interface.
 */
export function buildGrid(rows, cols) {
  const step = 80 / (cols - 1);
  const holes = [];
  for (let r = 0; r < rows; r += 1) {
    const even = r % 2 === 0;
    const count = even ? cols : cols - 1;
    const start = even ? 50 - ((cols - 1) / 2) * step : 50 - ((cols - 2) / 2) * step;
    for (let c = 0; c < count; c += 1) {
      holes.push({ cx: ROW_X0 + r * ROW_STEP, cy: Number((start + c * step).toFixed(2)), v: null });
    }
  }
  const width = ROW_X0 * 2 + Math.max(0, rows - 1) * ROW_STEP;
  return { holes, viewBox: `-6 -6 ${Math.round(width + 12)} 112` };
}
