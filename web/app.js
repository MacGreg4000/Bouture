const SVG_NS = 'http://www.w3.org/2000/svg';

const STATUS_LABELS = {
  seme: 'Semé',
  germe: 'Germé',
  repique: 'Repiqué',
  rate: 'Raté',
};

const OUTCOME_LABELS = {
  recolte: 'Récolté',
  repique: 'Repiqué',
  rate: 'Raté',
  abandon: 'Vidé',
};

// Le statut se lit sur le contour du trou : la couleur de remplissage reste
// celle de la variete, sinon les couleurs vives deviennent illisibles.
const STATUS_STROKE = {
  seme: { width: 1, dash: null },
  germe: { width: 2.4, dash: null },
  repique: { width: 2.4, dash: '3 2' },
  rate: { width: 1.4, dash: '2 2' },
};

const state = {
  trays: [],
  tray: null,
  cells: [],
  varieties: [],
  holeRadius: 7.5,
  selectedCellId: null,
  quickfillVarietyId: null,
  towerAngle: 0,
  towerZoom: 1, // 1 = toute la tour visible
  towerPanY: 0, // décalage vertical de la fenêtre, en unités du viewBox
  towerNaturalBox: null, // {x,y,w,h} calculé par renderTower, base des calculs de zoom
  plants: [], // base de référence légumes/aromates (statique, chargée une fois)
  pickingForCellId: null, // trou en cours de sélection depuis le guide, ou null
};

const TOWER_MIN_ZOOM = 1;
const TOWER_MAX_ZOOM = 5;

/** « trou » pour un bac à plat, « pot » pour une tour. */
const cellNoun = () => (state.tray?.kind === 'tower' ? 'pot' : 'trou');

/**
 * Colonne (file verticale de pots) d'un pot de tour, numérotée à partir de 1.
 * Un étage sur deux étant décalé d'un demi-pas, il y a deux fois plus de
 * colonnes que de pots par étage : les étages impairs occupent les colonnes
 * impaires, les étages pairs les colonnes paires.
 */
const cellColumn = (cell) =>
  cell.tier ? 2 * cell.slot + (cell.tier % 2 === 0 ? 1 : 0) + 1 : null;

/** « Trou 12 » pour un bac à plat, « Étage 3 · colonne 5 » pour une tour. */
const cellLabel = (cell) =>
  cell.tier ? `Étage ${cell.tier} · colonne ${cellColumn(cell)}` : `Trou ${cell.position}`;

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) node.append(child);
  return node;
};

/* ------------------------------------------------------------------- API */

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
  return data;
}

let toastTimer = null;
function toast(message, isError = false) {
  const node = $('toast');
  node.textContent = message;
  node.classList.toggle('toast--error', isError);
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, isError ? 4500 : 2200);
}

const run = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (err) {
    toast(err.message, true);
  }
};

/* -------------------------------------------------------------- utilitaires */

const today = () => new Date().toISOString().slice(0, 10);

function daysSince(isoDate) {
  if (!isoDate) return null;
  const start = Date.parse(`${isoDate}T00:00:00`);
  if (Number.isNaN(start)) return null;
  const now = Date.parse(`${today()}T00:00:00`);
  return Math.round((now - start) / 86400000);
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function textColorOn(hex) {
  if (!hex) return 'currentColor';
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#1d2721' : '#ffffff';
}

const varietyById = (id) => state.varieties.find((v) => v.id === id) ?? null;
const cellById = (id) => state.cells.find((c) => c.id === id) ?? null;

/* ------------------------------------------------------------- chargement */

async function load(trayId = null) {
  const target = trayId ?? state.tray?.id ?? Number(localStorage.getItem('bouture.tray')) ?? null;
  const previousTrayId = state.tray?.id ?? null;
  const data = await api(`/state${target ? `?tray=${target}` : ''}`);
  state.trays = data.trays;
  state.tray = data.tray;
  state.cells = data.cells;
  state.varieties = data.varieties;
  state.holeRadius = data.holeRadius;
  if (state.tray && state.tray.id !== previousTrayId) {
    // Changer de bac ne doit pas garder la rotation/le zoom du precedent.
    state.towerAngle = 0;
    state.towerZoom = 1;
    state.towerPanY = 0;
  }
  if (state.tray) localStorage.setItem('bouture.tray', String(state.tray.id));
  renderAll();
}

/** Base de référence légumes/aromates : statique côté serveur, on ne la charge qu'une fois. */
async function loadPlants() {
  if (state.plants.length) return;
  state.plants = await api('/plants');
}

/** Enlève les accents et met en minuscules — miroir de db/plants.js côté serveur. */
function normalizePlantName(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Trouve la fiche de la base de référence correspondant le mieux à un nom de variété libre. */
function matchPlant(varietyName) {
  const needle = normalizePlantName(varietyName);
  if (!needle) return null;
  for (const plant of state.plants) {
    if (plant.aliases.some((alias) => normalizePlantName(alias) === needle)) return plant;
  }
  for (const plant of state.plants) {
    if (
      plant.aliases.some((alias) => needle.includes(normalizePlantName(alias)) || normalizePlantName(alias).includes(needle))
    ) {
      return plant;
    }
  }
  return null;
}

function renderAll() {
  renderTraySelect();
  renderStats();
  renderPlan();
  renderQuickfill();
}

/* ------------------------------------------------------------------ plan */

function renderTraySelect() {
  const select = $('tray-select');
  select.replaceChildren(
    ...state.trays.map((tray) => {
      const option = document.createElement('option');
      option.value = String(tray.id);
      option.textContent = tray.name;
      option.selected = tray.id === state.tray?.id;
      return option;
    }),
  );
}

function renderStats() {
  const counters = { total: state.cells.length, occupied: 0, germe: 0, repique: 0, rate: 0 };
  for (const cell of state.cells) {
    if (!cell.planting) continue;
    counters.occupied += 1;
    if (cell.planting.status in counters) counters[cell.planting.status] += 1;
  }
  const noun = state.tray?.kind === 'tower' ? 'pots occupés' : 'trous occupés';
  const chips = [
    `<b>${counters.occupied}</b> / ${counters.total} ${noun}`,
    `<b>${counters.germe}</b> germés`,
    `<b>${counters.repique}</b> repiqués`,
    `<b>${counters.rate}</b> ratés`,
  ];
  $('stats').innerHTML = chips.map((c) => `<span class="stat">${c}</span>`).join('');
}

// Le bac est bien plus long que large : sur un telephone tenu verticalement on
// le fait pivoter d'un quart de tour, sinon les trous deviennent trop petits
// pour etre touches et le plan deborde en largeur.
const isPortrait = () => window.matchMedia('(max-width: 600px)').matches;

const LAMP_STEM = 8; // longueur du pied qui depasse du bac
const LAMP_R = 4.6; // rayon de l'ampoule
const LAMP_DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/**
 * Repere d'orientation : le pied telescopique de la lampe. Le symbole est
 * radial (ampoule + rayons) donc il reste lisible meme quand le plan pivote.
 */
function renderLamp(lamp, dir) {
  const bx = lamp.cx + dir.dx * (LAMP_STEM + LAMP_R);
  const by = lamp.cy + dir.dy * (LAMP_STEM + LAMP_R);
  const group = el('g', { class: 'lamp' });

  group.append(
    el('line', {
      x1: lamp.cx,
      y1: lamp.cy,
      x2: lamp.cx + dir.dx * LAMP_STEM,
      y2: lamp.cy + dir.dy * LAMP_STEM,
      stroke: 'var(--tray-edge)',
      'stroke-width': 2.6,
      'stroke-linecap': 'round',
    }),
    el('circle', {
      cx: bx,
      cy: by,
      r: LAMP_R,
      fill: 'var(--lamp)',
      stroke: 'var(--tray-edge)',
      'stroke-width': 1,
    }),
  );

  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    group.append(
      el('line', {
        x1: bx + cos * (LAMP_R + 1.4),
        y1: by + sin * (LAMP_R + 1.4),
        x2: bx + cos * (LAMP_R + 3.4),
        y2: by + sin * (LAMP_R + 3.4),
        stroke: 'var(--lamp)',
        'stroke-width': 1.1,
        'stroke-linecap': 'round',
      }),
    );
  }

  group.append(el('title', {}, 'Pied de la lampe'));
  return group;
}

function renderPlan() {
  const svg = $('plan');
  hideTooltip(); // les emplacements survoles vont etre remplaces
  svg.replaceChildren();
  if (!state.tray) return;

  const tower = state.tray.kind === 'tower';
  svg.classList.toggle('plan--tower', tower);
  // Classe posee en JS plutot que via un selecteur CSS :has() : ce dernier
  // n'est pas supporte partout, et la regle passait alors totalement
  // inaperçue, laissant la carte pleine largeur avec la tour minuscule au
  // milieu, noyee dans un grand vide.
  $('plan-wrap').classList.toggle('board__plan--tower', tower);
  $('rotator').hidden = !tower;
  $('towerzoom').hidden = !tower;
  if (tower) {
    renderTower(svg);
    updateTowerZoomButtons();
  } else {
    renderFlatPlan(svg);
  }
}

function renderFlatPlan(svg) {
  const trayBox = state.tray.viewBox || '-14 -14 224 128';
  let [minX, minY, width, height] = trayBox.split(/\s+/).map(Number);
  const portrait = isPortrait();

  // Le repere de la lampe depasse du bac : on agrandit la zone de dessin de ce
  // cote-la, sans toucher au cadre du bac lui-meme.
  const lamp = state.tray.lamp;
  const lampDir = LAMP_DIRECTIONS[lamp?.dir] ?? LAMP_DIRECTIONS.up;
  if (lamp) {
    const pad = LAMP_STEM + LAMP_R * 2 + 2;
    if (lampDir.dx < 0) { minX -= pad; width += pad; }
    if (lampDir.dx > 0) width += pad;
    if (lampDir.dy < 0) { minY -= pad; height += pad; }
    if (lampDir.dy > 0) height += pad;
  }

  const viewBox = `${minX} ${minY} ${width} ${height}`;
  const [trayX, trayY, trayW, trayH] = trayBox.split(/\s+/).map(Number);

  // rotate(90) envoie (x, y) sur (-y, x) : la boite tournee part donc en
  // -(minY + height) sur x et en minX sur y, avec largeur et hauteur echangees.
  svg.setAttribute(
    'viewBox',
    portrait ? `${-(minY + height)} ${minX} ${height} ${width}` : viewBox,
  );

  const root = portrait ? el('g', { transform: 'rotate(90)' }) : svg;
  if (portrait) svg.append(root);

  root.append(
    el('rect', {
      x: trayX + 3,
      y: trayY + 3,
      width: trayW - 6,
      height: trayH - 6,
      rx: Math.min(trayW, trayH) * 0.28,
      fill: 'var(--tray)',
      stroke: 'var(--tray-edge)',
      'stroke-width': 1.4,
    }),
  );

  if (lamp) root.append(renderLamp(lamp, lampDir));

  if (state.tray.reservoir) {
    const { cx, cy, r } = state.tray.reservoir;
    root.append(
      el('circle', {
        cx,
        cy,
        r,
        fill: 'var(--surface-2)',
        stroke: 'var(--tray-edge)',
        'stroke-width': 1.2,
      }),
      el('circle', { cx, cy, r: r - 3.5, fill: 'none', stroke: 'var(--tray-edge)', 'stroke-width': 0.8 }),
    );
  }

  const r = state.holeRadius;
  const highlightId = state.quickfillVarietyId;

  for (const cell of state.cells) {
    const planting = cell.planting;
    const color = planting?.varietyColor || null;
    const status = planting?.status ?? null;

    const group = el('g', {
      class: [
        'hole',
        planting ? 'hole--filled' : 'hole--empty',
        cell.id === state.selectedCellId ? 'hole--selected' : '',
      ]
        .filter(Boolean)
        .join(' '),
      'data-cell': cell.id,
      role: 'button',
      tabindex: '0',
      // Pas de <title> : il declencherait l'infobulle native du navigateur en
      // plus de la notre, avec une seconde de retard.
      'aria-label': describeCell(cell),
    });

    const failed = status === 'rate';
    const stroke = STATUS_STROKE[status] ?? STATUS_STROKE.seme;
    // Contour : neutre pour un trou vide, rouge pour un rate, sinon une couleur
    // qui contraste avec le remplissage (blanche sur fond sombre et inversement).
    const strokeColor = !planting
      ? 'var(--tray-edge)'
      : failed
        ? 'var(--danger)'
        : textColorOn(color);

    group.append(
      el('circle', {
        class: 'hole__ring',
        cx: cell.cx,
        cy: cell.cy,
        r,
        fill: color || 'var(--hole)',
        'fill-opacity': failed ? 0.2 : 1,
        stroke: strokeColor,
        'stroke-width': planting ? stroke.width : 1,
        'stroke-opacity': planting && !failed ? 0.55 : 1,
        'stroke-dasharray': !planting ? '2 2' : stroke.dash,
      }),
    );

    if (highlightId && planting?.varietyId === highlightId) {
      group.append(
        el('circle', {
          cx: cell.cx,
          cy: cell.cy,
          r: r + 1.8,
          fill: 'none',
          stroke: 'var(--accent)',
          'stroke-width': 1.4,
        }),
      );
    }

    if (cell.id === state.selectedCellId) {
      group.append(
        el('circle', {
          class: 'hole__sel',
          cx: cell.cx,
          cy: cell.cy,
          r: r + 2.6,
        }),
      );
    }

    const variety = planting?.varietyId ? varietyById(planting.varietyId) : null;
    const label = variety?.number ?? (planting ? '•' : cell.position);
    group.append(
      el(
        'text',
        {
          class: 'hole__num',
          x: cell.cx,
          y: cell.cy,
          // Sur un trou rate le fond est efface : on repasse sur la couleur de texte neutre.
          fill: planting && !failed ? textColorOn(color) : 'var(--muted)',
          'fill-opacity': planting ? 0.95 : 0.5,
          // Contre-rotation pour que les numeros restent lisibles a l'endroit.
          transform: portrait ? `rotate(-90 ${cell.cx} ${cell.cy})` : null,
        },
        String(label),
      ),
    );

    root.append(group);
  }
}

/* ----------------------------------------------------------------- la tour */

/**
 * Une tour est dessinee en projection « tourne-disque » : les pots d'un etage
 * sont repartis sur un cercle vu de trois quarts, ecrase verticalement. Pour un
 * pot d'angle t : x = sin(t), et cos(t) donne a la fois le decalage vertical,
 * la taille, l'opacite et l'ordre d'affichage (les pots de derriere passent
 * derriere la colonne). Pas de WebGL : ca reste du SVG cliquable.
 */
const TOWER = {
  colW: 32, // largeur de la colonne
  // tierH doit rester > 2*ringRy + potH, sinon un pot de devant chevauche le
  // pot de derriere de l'etage suivant.
  tierH: 54, // ecart vertical entre deux etages
  ringR: 52, // rayon horizontal du cercle des pots
  // ringRy = a quel point on regarde la tour de haut. Trop bas, les pots de
  // devant et de derriere se superposent ; trop haut, les etages se telescopent.
  ringRy: 15,
  potW: 34,
  potH: 22,
  topY: 40, // hauteur du premier etage
  baseH: 46,
  badgeTop: 40, // place reservee au-dessus pour les numeros de colonne
  badgeR: 9.5,
};

const towerGeometry = () => ({
  tiers: state.tray?.tower?.tiers ?? 10,
  potsPerTier: state.tray?.tower?.potsPerTier ?? 4,
});

function potPath(w, h) {
  return [
    `M ${-w / 2},${-h / 2}`,
    `L ${w / 2},${-h / 2}`,
    `L ${w * 0.3},${h * 0.4}`,
    `Q ${w * 0.28},${h / 2} ${w * 0.2},${h / 2}`,
    `L ${-w * 0.2},${h / 2}`,
    `Q ${-w * 0.28},${h / 2} ${-w * 0.3},${h * 0.4}`,
    'Z',
  ].join(' ');
}

function renderTower(svg) {
  const { tiers, potsPerTier } = towerGeometry();
  const lastTierY = TOWER.topY + (tiers - 1) * TOWER.tierH;
  const baseTop = lastTierY + 28;
  const totalH = baseTop + TOWER.baseH + 18;
  // De la place au-dessus de la tour pour les numéros de colonne flottants.
  // Le viewBox réel (avec zoom/pan) est posé à la fin de la fonction par
  // applyTowerView, une fois tous les éléments ajoutés.
  state.towerNaturalBox = { x: -100, y: -TOWER.badgeTop, w: 200, h: totalH + TOWER.badgeTop };

  // Ombrage de cylindre, en noir/blanc translucide pour marcher dans les deux
  // thèmes : un dégradé sur une couleur fixe serait faux en clair ou en sombre.
  const shading = el('linearGradient', { id: 'towerShade', x1: 0, x2: 1, y1: 0, y2: 0 });
  for (const [offset, color, opacity] of [
    [0, '#000', 0.2],
    [0.3, '#fff', 0.07],
    [0.47, '#fff', 0.18],
    [0.72, '#000', 0.05],
    [1, '#000', 0.24],
  ]) {
    shading.append(el('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }));
  }
  svg.append(el('defs', {}, shading));

  const step = (Math.PI * 2) / potsPerTier;
  const rotation = (state.towerAngle * Math.PI) / 180;

  const pots = state.cells
    .filter((cell) => cell.tier)
    .map((cell) => {
      // Un etage sur deux est decale d'un demi-pas, comme sur la vraie tour.
      const angle = cell.slot * step + (cell.tier % 2 === 0 ? step / 2 : 0) + rotation;
      const cos = Math.cos(angle);
      return {
        cell,
        x: Math.sin(angle) * TOWER.ringR,
        y: TOWER.topY + (cell.tier - 1) * TOWER.tierH + cos * TOWER.ringRy,
        depth: cos, // +1 = devant, -1 = derriere
        scale: 0.74 + 0.26 * ((cos + 1) / 2),
      };
    })
    .sort((a, b) => a.depth - b.depth);

  // 1. les pots de derriere, 2. la colonne qui les masque, 3. le bac,
  // 4. les pots de devant.
  for (const pot of pots.filter((p) => p.depth < 0)) svg.append(renderPot(pot));

  const colBox = {
    x: -TOWER.colW / 2,
    y: TOWER.topY - 26,
    width: TOWER.colW,
    height: baseTop + 10 - (TOWER.topY - 26),
    rx: 5,
  };
  svg.append(
    el('rect', { ...colBox, fill: 'var(--tray)' }),
    el('rect', { ...colBox, fill: 'url(#towerShade)' }),
    el('rect', { ...colBox, fill: 'none', stroke: 'var(--tray-edge)', 'stroke-width': 1.4 }),
    el('ellipse', {
      cx: 0,
      cy: TOWER.topY - 26,
      rx: TOWER.colW / 2,
      ry: TOWER.colW / 4,
      fill: 'var(--tray)',
      stroke: 'var(--tray-edge)',
      'stroke-width': 1.2,
      filter: 'brightness(1.06)',
    }),
  );

  svg.append(renderTowerBase(baseTop));

  for (const pot of pots.filter((p) => p.depth >= 0)) svg.append(renderPot(pot));

  svg.append(renderColumnBadges(potsPerTier, step, rotation));

  // Numeros d'etage, pour se reperer quand la tour tourne.
  for (let tier = 1; tier <= tiers; tier += 1) {
    svg.append(
      el(
        'text',
        {
          class: 'tower__tier',
          x: -(TOWER.ringR + TOWER.potW / 2 + 6),
          y: TOWER.topY + (tier - 1) * TOWER.tierH,
          'text-anchor': 'end',
          fill: 'var(--muted)',
        },
        String(tier),
      ),
    );
  }

  applyTowerView(svg);
}

/**
 * Applique le zoom/pan courants au viewBox de la tour, en repartant de la
 * "boite naturelle" (tour entiere visible) calculee par renderTower. Le zoom
 * est uniforme sur les deux axes ; l'exploration horizontale se fait par
 * rotation plutot que par un panoramique, donc le centre horizontal reste fixe.
 */
function applyTowerView(svg) {
  const box = state.towerNaturalBox;
  if (!box) return;
  const zoom = state.towerZoom;
  const viewW = box.w / zoom;
  const viewH = box.h / zoom;
  const maxPanY = Math.max(0, (box.h - viewH) / 2);
  state.towerPanY = Math.max(-maxPanY, Math.min(maxPanY, state.towerPanY));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2 + state.towerPanY;
  svg.setAttribute(
    'viewBox',
    `${(cx - viewW / 2).toFixed(2)} ${(cy - viewH / 2).toFixed(2)} ${viewW.toFixed(2)} ${viewH.toFixed(2)}`,
  );
}

/**
 * Numeros de colonne flottant au-dessus de la tour. Ils suivent la rotation
 * comme les pots, et celui de la colonne qui fait face est mis en avant : c'est
 * lui qui dit ou l'on se trouve a un instant donne.
 */
function renderColumnBadges(potsPerTier, step, rotation) {
  const group = el('g', { class: 'tower__badges' });
  const half = step / 2;
  const y = -TOWER.badgeTop + TOWER.badgeR + 4;

  const badges = [];
  for (let c = 0; c < potsPerTier * 2; c += 1) {
    const angle = c * half + rotation;
    badges.push({ n: c + 1, x: Math.sin(angle) * TOWER.ringR, depth: Math.cos(angle) });
  }
  badges.sort((a, b) => a.depth - b.depth);
  const frontDepth = badges[badges.length - 1].depth;

  for (const badge of badges) {
    const front = badge.depth === frontDepth;
    const scale = 0.66 + 0.34 * ((badge.depth + 1) / 2);
    const item = el('g', {
      transform: `translate(${badge.x.toFixed(2)} ${y}) scale(${scale.toFixed(3)})`,
      // Les colonnes de derriere s'agglutinent vers le centre : on les efface
      // franchement pour ne garder que celles qui font face.
      opacity: (0.22 + 0.78 * ((badge.depth + 1) / 2)).toFixed(3),
    });
    item.append(
      el('circle', {
        cx: 0,
        cy: 0,
        r: TOWER.badgeR,
        fill: front ? 'var(--accent)' : 'var(--surface-2)',
        stroke: front ? 'var(--accent)' : 'var(--border)',
        'stroke-width': 1,
      }),
      el(
        'text',
        {
          class: 'tower__col',
          x: 0,
          y: 0,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          fill: front ? '#fff' : 'var(--muted)',
        },
        String(badge.n),
      ),
    );
    group.append(item);
  }
  return group;
}

function renderTowerBase(baseTop) {
  const group = el('g', {});
  const top = 58;
  const bottom = 48;
  const h = TOWER.baseH;
  const shape = {
      d: [
        `M ${-top},${baseTop}`,
        `L ${top},${baseTop}`,
        `L ${bottom},${baseTop + h}`,
        `Q ${bottom},${baseTop + h + 5} ${bottom - 6},${baseTop + h + 5}`,
        `L ${-bottom + 6},${baseTop + h + 5}`,
        `Q ${-bottom},${baseTop + h + 5} ${-bottom},${baseTop + h}`,
        'Z',
      ].join(' '),
  };
  group.append(
    el('path', { ...shape, fill: 'var(--tray)' }),
    el('path', { ...shape, fill: 'url(#towerShade)' }),
    el('path', { ...shape, fill: 'none', stroke: 'var(--tray-edge)', 'stroke-width': 1.4 }),
    el('ellipse', {
      cx: 0,
      cy: baseTop,
      rx: top,
      ry: 10,
      fill: 'var(--tray)',
      stroke: 'var(--tray-edge)',
      'stroke-width': 1.2,
      filter: 'brightness(1.06)',
    }),
    // hublot de niveau d'eau
    el('rect', {
      x: -34,
      y: baseTop + 12,
      width: 7,
      height: h - 4,
      rx: 3.5,
      fill: 'var(--surface-2)',
      stroke: 'var(--tray-edge)',
      'stroke-width': 0.8,
    }),
  );
  return group;
}

function renderPot({ cell, x, y, depth, scale }) {
  const planting = cell.planting;
  const color = planting?.varietyColor || null;
  const status = planting?.status ?? null;
  const failed = status === 'rate';
  const stroke = STATUS_STROKE[status] ?? STATUS_STROKE.seme;
  const strokeColor = !planting
    ? 'var(--tray-edge)'
    : failed
      ? 'var(--danger)'
      : textColorOn(color);
  // Un pot vide reste un pot : meme matiere que la colonne. (Sur un bac a plat,
  // un trou vide laisse voir le reservoir, d'ou --hole la-bas.)
  const emptyFill = 'var(--tray)';

  const group = el('g', {
    class: [
      'hole',
      planting ? 'hole--filled' : 'hole--empty',
      cell.id === state.selectedCellId ? 'hole--selected' : '',
    ]
      .filter(Boolean)
      .join(' '),
    'data-cell': cell.id,
    role: 'button',
    tabindex: '0',
    'aria-label': describeCell(cell),
    transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(3)})`,
    // Les pots de derriere sont estompes : c'est ce qui donne la profondeur.
    opacity: (0.5 + 0.5 * ((depth + 1) / 2)).toFixed(3),
  });

  const { potW: w, potH: h } = TOWER;

  group.append(
    el('path', {
      d: potPath(w, h),
      fill: color || emptyFill,
      'fill-opacity': failed ? 0.2 : 1,
      stroke: strokeColor,
      'stroke-width': planting ? stroke.width : 1,
      'stroke-opacity': planting && !failed ? 0.55 : 1,
      'stroke-dasharray': !planting ? '2 2' : stroke.dash,
      'stroke-linejoin': 'round',
    }),
    // ouverture du pot
    el('ellipse', {
      cx: 0,
      cy: -h / 2,
      rx: w / 2,
      ry: w / 9,
      fill: color || emptyFill,
      'fill-opacity': failed ? 0.25 : 1,
      stroke: strokeColor,
      'stroke-width': planting ? 0.9 : 1,
      'stroke-opacity': 0.55,
      filter: 'brightness(0.82)',
    }),
  );

  if (cell.id === state.selectedCellId) {
    group.append(
      el('rect', {
        x: -w / 2 - 3,
        y: -h / 2 - w / 9 - 3,
        width: w + 6,
        height: h + w / 9 + 6,
        rx: 5,
        fill: 'none',
        stroke: 'var(--accent)',
        'stroke-width': 2,
      }),
    );
  }

  const variety = planting?.varietyId ? varietyById(planting.varietyId) : null;
  const label = variety?.number ?? (planting ? '•' : '');
  if (label !== '') {
    group.append(
      el(
        'text',
        {
          class: 'tower__num',
          x: 0,
          y: h * 0.05,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          fill: planting && !failed ? textColorOn(color) : 'var(--muted)',
        },
        String(label),
      ),
    );
  }

  return group;
}

/* ------------------------------------------------- rotation, zoom et pan de la tour */

function setTowerAngle(degrees) {
  state.towerAngle = ((degrees % 360) + 360) % 360;
  $('rot-range').value = String(Math.round(state.towerAngle));
  renderPlan();
}

/**
 * Zoome la tour en gardant le point svg situé à `clientY` immobile à l'écran
 * (comportement « zoom sous le curseur/les doigts »). `factor` est relatif au
 * zoom courant : >1 rapproche, <1 éloigne.
 */
function zoomTowerAround(clientY, factor) {
  const svg = $('plan');
  const box = state.towerNaturalBox;
  if (!box) return;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const point = svg.createSVGPoint();
  point.y = clientY;
  const svgPoint = point.matrixTransform(ctm.inverse());

  const oldZoom = state.towerZoom;
  const newZoom = Math.max(TOWER_MIN_ZOOM, Math.min(TOWER_MAX_ZOOM, oldZoom * factor));
  if (Math.abs(newZoom - oldZoom) < 1e-6) return;

  const oldViewH = box.h / oldZoom;
  const newViewH = box.h / newZoom;
  const oldTop = box.y + box.h / 2 + state.towerPanY - oldViewH / 2;
  const fraction = (svgPoint.y - oldTop) / oldViewH;

  state.towerZoom = newZoom;
  state.towerPanY = svgPoint.y - fraction * newViewH + newViewH / 2 - (box.y + box.h / 2);
  renderPlan();
  updateTowerZoomButtons();
}

/** Fait défiler la fenêtre le long de la tour, en suivant le doigt/curseur. */
function panTowerBy(deltaClientY) {
  const svg = $('plan');
  const ctm = svg.getScreenCTM();
  if (!ctm || !ctm.d) return;
  // Le contenu doit suivre le doigt (comme un défilement tactile classique) :
  // glisser vers le bas doit révéler ce qu'il y a au-dessus.
  state.towerPanY -= deltaClientY / ctm.d;
  renderPlan();
}

function resetTowerView() {
  state.towerZoom = 1;
  state.towerPanY = 0;
  renderPlan();
  updateTowerZoomButtons();
}

function updateTowerZoomButtons() {
  $('zoom-out').disabled = state.towerZoom <= TOWER_MIN_ZOOM + 1e-6;
  $('zoom-in').disabled = state.towerZoom >= TOWER_MAX_ZOOM - 1e-6;
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

let towerDrag = null; // rotation + pan a un seul doigt/pointeur
let towerPinch = null; // zoom a deux doigts
const towerTouches = new Map(); // pointerId -> {x, y}, pour reperer le pincement
let suppressClick = false;

function startTowerPinch() {
  const points = [...towerTouches.values()];
  towerPinch = { lastDistance: distance(points[0], points[1]), midY: (points[0].y + points[1].y) / 2 };
  towerDrag = null; // le pincement remplace le geste a un doigt
  hideTooltip();
}

$('plan').addEventListener('pointerdown', (event) => {
  if (state.tray?.kind !== 'tower') return;
  // Sans ca, le navigateur demarre sa selection native et surligne tout le SVG.
  event.preventDefault();

  if (event.pointerType === 'touch') {
    towerTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (towerTouches.size === 2) {
      startTowerPinch();
      return;
    }
    if (towerTouches.size > 2) return; // un 3e doigt : on ignore
  }

  towerDrag = {
    x: event.clientX,
    y: event.clientY,
    lastY: event.clientY,
    angle: state.towerAngle,
    moved: false,
  };
});

$('plan').addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch' && towerTouches.has(event.pointerId)) {
    towerTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  if (towerPinch && towerTouches.size === 2) {
    const points = [...towerTouches.values()];
    const currentDistance = distance(points[0], points[1]);
    const midY = (points[0].y + points[1].y) / 2;
    zoomTowerAround(midY, currentDistance / towerPinch.lastDistance);
    towerPinch.lastDistance = currentDistance;
    suppressClick = true;
    return;
  }

  if (!towerDrag) return;
  const dx = event.clientX - towerDrag.x;
  const dy = event.clientY - towerDrag.y;
  if (!towerDrag.moved) {
    if (Math.hypot(dx, dy) <= 4) return; // simple clic, pas encore un glissement
    towerDrag.moved = true;
    hideTooltip();
    $('plan').classList.add('is-grabbing');
    // On ne capture le pointeur qu'une fois le glissement engage : capturer
    // des le pointerdown enverrait le clic suivant au SVG et non au pot, et la
    // fiche ne s'ouvrirait plus.
    $('plan').setPointerCapture(event.pointerId);
  }
  setTowerAngle(towerDrag.angle + dx * 0.7);
  // Le panoramique vertical ne sert que zoomé : a plat, il est neutralisé par
  // le clamp de applyTowerView, autant eviter le re-rendu pour rien.
  if (state.towerZoom > TOWER_MIN_ZOOM + 1e-6) panTowerBy(event.clientY - towerDrag.lastY);
  towerDrag.lastY = event.clientY;
});

for (const type of ['pointerup', 'pointercancel']) {
  $('plan').addEventListener(type, (event) => {
    if (event.pointerType === 'touch') towerTouches.delete(event.pointerId);
    if (towerTouches.size < 2) towerPinch = null;

    if (!towerDrag) return;
    // Un glissement ne doit pas ouvrir la fiche du pot relache.
    suppressClick = suppressClick || towerDrag.moved;
    towerDrag = null;
    $('plan').classList.remove('is-grabbing');
    if ($('plan').hasPointerCapture?.(event.pointerId)) {
      $('plan').releasePointerCapture(event.pointerId);
    }
  });
}

// Molette : zoom centre sur le curseur, comme une carte.
$('plan').addEventListener(
  'wheel',
  (event) => {
    if (state.tray?.kind !== 'tower') return;
    event.preventDefault();
    zoomTowerAround(event.clientY, event.deltaY < 0 ? 1.15 : 1 / 1.15);
  },
  { passive: false },
);

// Double-clic/double-tap : revient a la vue d'ensemble.
$('plan').addEventListener('dblclick', () => {
  if (state.tray?.kind === 'tower') resetTowerView();
});

$('rot-range').addEventListener('input', (event) => setTowerAngle(Number(event.target.value)));
$('rot-left').addEventListener('click', () =>
  setTowerAngle(state.towerAngle - 360 / towerGeometry().potsPerTier),
);
$('rot-right').addEventListener('click', () =>
  setTowerAngle(state.towerAngle + 360 / towerGeometry().potsPerTier),
);

$('zoom-out').addEventListener('click', () => {
  const rect = $('plan').getBoundingClientRect();
  zoomTowerAround(rect.top + rect.height / 2, 1 / 1.4);
});
$('zoom-in').addEventListener('click', () => {
  const rect = $('plan').getBoundingClientRect();
  zoomTowerAround(rect.top + rect.height / 2, 1.4);
});
$('zoom-reset').addEventListener('click', resetTowerView);

// Bascule paysage <-> portrait : on redessine quand le seuil est franchi.
let wasPortrait = isPortrait();
window.addEventListener('resize', () => {
  if (isPortrait() === wasPortrait) return;
  wasPortrait = isPortrait();
  renderPlan();
});

/* --------------------------------------------------------------- infobulle */

const canHover = () => window.matchMedia('(hover: hover)').matches;

function tooltipHtml(cell) {
  const planting = cell.planting;
  const lines = [`<b>${escapeHtml(cellLabel(cell))}</b>`];

  if (!planting) {
    lines.push('<span class="tip__muted">Vide</span>');
  } else {
    lines.push(
      `<span class="tip__variety">
         <span class="tip__dot" style="background:${planting.varietyColor || 'var(--muted)'}"></span>
         ${escapeHtml(planting.varietyLabel || 'Sans variété')}
       </span>`,
    );

    const age = daysSince(planting.sownOn);
    const meta = [STATUS_LABELS[planting.status] ?? planting.status];
    if (planting.sownOn) {
      meta.push(`semé le ${formatDate(planting.sownOn)}`);
      if (age !== null) meta.push(age === 0 ? "aujourd'hui" : `${age} j`);
    }
    lines.push(`<span class="tip__muted">${escapeHtml(meta.join(' · '))}</span>`);

    if (planting.note) lines.push(`<span class="tip__note">${escapeHtml(planting.note)}</span>`);
  }

  if (cell.historyCount) {
    const plural = cell.historyCount > 1 ? 's' : '';
    lines.push(`<span class="tip__muted">${cell.historyCount} cycle${plural} archivé${plural}</span>`);
  }
  return lines.join('');
}

function moveTooltip(event) {
  const tip = $('tip');
  const margin = 12;
  const { width, height } = tip.getBoundingClientRect();
  // Par defaut en bas a droite du curseur, bascule si on sort de l'ecran.
  let x = event.clientX + 16;
  let y = event.clientY + 16;
  if (x + width + margin > window.innerWidth) x = event.clientX - width - 16;
  if (y + height + margin > window.innerHeight) y = event.clientY - height - 16;
  tip.style.left = `${Math.max(margin, x)}px`;
  tip.style.top = `${Math.max(margin, y)}px`;
}

function hideTooltip() {
  $('tip').hidden = true;
}

function describeCell(cell) {
  if (!cell.planting) return `${cellLabel(cell)} — vide`;
  const age = daysSince(cell.planting.sownOn);
  const parts = [
    cellLabel(cell),
    cell.planting.varietyLabel || 'sans variété',
    STATUS_LABELS[cell.planting.status] ?? cell.planting.status,
  ];
  if (age !== null) parts.push(`${age} j`);
  return parts.join(' — ');
}

/* ------------------------------------------------------------- quickfill */

function renderQuickfill() {
  const bar = $('quickfill');
  const variety = state.quickfillVarietyId ? varietyById(state.quickfillVarietyId) : null;
  if (!variety) {
    bar.hidden = true;
    const tower = state.tray?.kind === 'tower';
    const what = tower ? 'un pot' : 'un trou';
    const towerHint = tower
      ? canHover()
        ? ' Fais glisser la tour pour la tourner, molette pour zoomer.'
        : ' Fais glisser la tour pour la tourner, pince pour zoomer.'
      : '';
    $('hint').textContent = canHover()
      ? `Survole ${what} pour voir son contenu, clique pour le modifier.${towerHint}`
      : `Touche ${what} pour renseigner ce que tu y as mis.${towerHint}`;
    return;
  }
  bar.hidden = false;
  $('quickfill-dot').style.background = variety.color;
  $('quickfill-label').textContent = `Remplissage rapide : ${variety.name}`;
  $('hint').textContent =
    'Chaque trou touché reçoit cette variété, semée aujourd’hui. Pour vider un trou, ouvre-le et utilise « Vider le trou ».';
}

const applyQuickfill = run(async (cell) => {
  const variety = varietyById(state.quickfillVarietyId);
  if (!variety) return;
  const planting = await api(`/cells/${cell.id}/planting`, {
    method: 'PUT',
    body: JSON.stringify({
      varietyId: variety.id,
      sownOn: cell.planting?.sownOn ?? today(),
      status: cell.planting?.status ?? 'seme',
      note: cell.planting?.note ?? null,
    }),
  });
  cell.planting = planting;
  renderStats();
  renderPlan();
  toast(`${cellLabel(cell)} → ${variety.name}`);
});

/* ----------------------------------------------------------- fiche du trou */

function openCellSheet(cell) {
  state.selectedCellId = cell.id;
  renderPlan();

  $('cell-title').textContent = cellLabel(cell);

  const select = $('f-variety');
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '— vide —';
  select.replaceChildren(
    empty,
    ...state.varieties
      .filter((v) => !v.archived || v.id === cell.planting?.varietyId)
      .map((v) => {
        const option = document.createElement('option');
        option.value = String(v.id);
        option.textContent = v.number ? `${v.number}. ${v.name}` : v.name;
        return option;
      }),
  );
  select.value = cell.planting?.varietyId ? String(cell.planting.varietyId) : '';

  $('f-sown').value = cell.planting?.sownOn ?? '';
  $('f-status').value = cell.planting?.status ?? 'seme';
  $('f-note').value = cell.planting?.note ?? '';
  updateAge();
  renderPlantInfo();

  $('btn-clear').hidden = !cell.planting;
  $('btn-clear').textContent = `Vider le ${cellNoun()}`;
  showClearChoices(false);
  renderHistory(cell);
  openSheet('cell-sheet');
}

function updateAge() {
  const age = daysSince($('f-sown').value);
  $('f-age').textContent = age === null ? '' : age === 0 ? 'Semé aujourd’hui.' : `Semé il y a ${age} jour${age > 1 ? 's' : ''}.`;
}

const SUITABILITY_LABEL = {
  adapted: 'Bien adaptée en tour',
  limited: 'Possible, avec réserve',
  not_recommended: 'Peu adaptée en tour',
};

/**
 * Affiche, dans la fiche du trou, la fiche technique de la base de
 * référence correspondant à la variété actuellement sélectionnée dans le
 * formulaire — et une estimation de la fenêtre de récolte si une date de
 * semis est renseignée.
 */
function renderPlantInfo() {
  const box = $('plant-info');
  const varietyId = $('f-variety').value;
  const variety = varietyId ? varietyById(Number(varietyId)) : null;
  const plant = variety ? matchPlant(variety.name) : null;

  if (!plant) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }

  const parts = [
    `<span class="plant-info__badge plant-info__badge--${plant.suitability}">${SUITABILITY_LABEL[plant.suitability]}</span>`,
    `<div class="plant-info__row"><b>Maturité</b> ${plant.daysMin}–${plant.daysMax} j après semis</div>`,
    `<div class="plant-info__row"><b>Lumière</b> ${escapeHtml(plant.light)}</div>`,
    `<div class="plant-info__row"><b>pH</b> ${escapeHtml(plant.ph)} · <b>EC</b> ${escapeHtml(plant.ec)}</div>`,
  ];

  const sownOn = $('f-sown').value;
  if (sownOn) {
    const start = Date.parse(`${sownOn}T00:00:00`);
    if (!Number.isNaN(start)) {
      const from = formatDate(new Date(start + plant.daysMin * 86400000).toISOString().slice(0, 10));
      const to = formatDate(new Date(start + plant.daysMax * 86400000).toISOString().slice(0, 10));
      parts.push(`<div class="plant-info__row"><b>Récolte estimée</b> entre le ${from} et le ${to}</div>`);
    }
  }

  parts.push(`<p class="plant-info__tip">${escapeHtml(plant.tip)}</p>`);
  parts.push('<p class="plant-info__disclaimer">Valeurs indicatives, à ajuster selon la variété et les conditions réelles.</p>');

  box.innerHTML = parts.join('');
  box.hidden = false;
}

const SUITABILITY_ORDER = { adapted: 0, limited: 1, not_recommended: 2 };

function guideItemHtml(p, { picking }) {
  const star = p.favorite ? '★' : '☆';
  const chooseBtn = picking
    ? `<button type="button" class="btn btn--small btn--primary guide__choose" data-key="${p.key}">Choisir</button>`
    : '';
  return `
    <li class="guide__item">
      <div class="guide__head">
        <button
          type="button"
          class="guide__star ${p.favorite ? 'guide__star--on' : ''}"
          data-fav-key="${p.key}"
          aria-label="${p.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
        >${star}</button>
        <span class="guide__name">${escapeHtml(p.name)}</span>
        <span class="plant-info__badge plant-info__badge--${p.suitability}">${SUITABILITY_LABEL[p.suitability]}</span>
      </div>
      <div class="guide__meta">
        <span>${escapeHtml(p.category)}</span>
        <span>Maturité : ${p.daysMin}–${p.daysMax} j</span>
        <span>Lumière : ${escapeHtml(p.light)}</span>
        <span>pH ${escapeHtml(p.ph)} · EC ${escapeHtml(p.ec)}</span>
      </div>
      <p class="guide__tip">${escapeHtml(p.tip)}</p>
      ${chooseBtn}
    </li>`;
}

/**
 * Liste filtrable du guide des légumes. En mode « sélection » (déclenché par
 * le bouton 🔍 de la fiche d'un trou), chaque entrée propose un bouton
 * « Choisir » qui assigne directement le légume au trou en cours.
 */
function renderGuide() {
  const list = $('guide-list');
  const query = normalizePlantName($('guide-search').value);
  const picking = state.pickingForCellId != null;

  $('guide-picking-banner').hidden = !picking;
  if (picking) {
    const cell = cellById(state.pickingForCellId);
    $('guide-picking-banner').textContent = cell
      ? `Sélection pour ${cellLabel(cell)} : touche « Choisir » sur un légume.`
      : '';
  }

  const matches = (p) =>
    !query || normalizePlantName(p.name).includes(query) || p.aliases.some((a) => normalizePlantName(a).includes(query));
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
  const bySuitability = (a, b) => SUITABILITY_ORDER[a.suitability] - SUITABILITY_ORDER[b.suitability] || byName(a, b);

  const filtered = state.plants.filter(matches);
  const favorites = filtered.filter((p) => p.favorite).sort(byName);
  const rest = filtered.filter((p) => !p.favorite).sort(bySuitability);

  if (!filtered.length) {
    list.innerHTML = '<li class="guide__empty">Aucun résultat.</li>';
    return;
  }

  const sections = [];
  if (favorites.length) {
    sections.push('<li class="guide__section">★ Favoris</li>');
    sections.push(...favorites.map((p) => guideItemHtml(p, { picking })));
    sections.push('<li class="guide__section">Tous les légumes</li>');
  }
  sections.push(...rest.map((p) => guideItemHtml(p, { picking })));

  list.innerHTML = sections.join('');
}

const toggleFavorite = run(async (key) => {
  const plant = state.plants.find((p) => p.key === key);
  if (!plant) return;
  await api(`/plants/${encodeURIComponent(key)}/favorite`, { method: plant.favorite ? 'DELETE' : 'PUT' });
  plant.favorite = !plant.favorite;
  renderGuide();
});

/**
 * Trouve, ou crée si besoin, la variété de la légende correspondant à un
 * légume du guide, puis l'assigne au trou en cours de sélection.
 */
const choosePlantForCell = run(async (key) => {
  const plant = state.plants.find((p) => p.key === key);
  const cell = cellById(state.pickingForCellId);
  if (!plant || !cell) return;

  const normalized = normalizePlantName(plant.name);
  let variety = state.varieties.find((v) => normalizePlantName(v.name) === normalized);
  if (!variety) {
    variety = await api('/varieties', {
      method: 'POST',
      body: JSON.stringify({ name: plant.name, color: CATEGORY_COLOR[plant.category] ?? '#6b9c42' }),
    });
  }

  await api(`/cells/${cell.id}/planting`, {
    method: 'PUT',
    body: JSON.stringify({
      varietyId: variety.id,
      sownOn: $('f-sown').value || today(),
      status: $('f-status').value || 'seme',
      note: $('f-note').value,
    }),
  });

  state.pickingForCellId = null;
  closeSheet('guide-sheet');
  await load();
  openCellSheet(cellById(cell.id));
  toast(`${cellLabel(cell)} → ${plant.name}`);
});

const CATEGORY_COLOR = {
  Feuille: '#6b9c42',
  Chou: '#4f8a3a',
  Aromate: '#3fa79a',
  Fruit: '#c1440e',
  Racine: '#d9a441',
  Bulbe: '#8a5fbd',
  Légumineuse: '#8ab33f',
  Cucurbitacée: '#d9c441',
};

const renderHistory = run(async (cell) => {
  const box = $('history');
  if (!cell.historyCount) {
    box.innerHTML = `<h3>Historique</h3><p class="history__empty">Aucun cycle terminé pour ce ${cellNoun()}.</p>`;
    return;
  }
  box.innerHTML = '<h3>Historique</h3><p class="history__empty">Chargement…</p>';
  const entries = await api(`/cells/${cell.id}/history`);
  const items = entries
    .map((entry) => {
      const age =
        entry.sownOn && entry.endedOn
          ? Math.round((Date.parse(entry.endedOn) - Date.parse(entry.sownOn)) / 86400000)
          : null;
      const meta = [
        `${formatDate(entry.sownOn)} → ${formatDate(entry.endedOn)}`,
        age !== null ? `${age} j` : null,
        OUTCOME_LABELS[entry.outcome] ?? entry.outcome,
      ]
        .filter(Boolean)
        .join(' · ');
      return `
        <div class="history__item">
          <span class="legend__swatch" style="background:${entry.varietyColor || 'var(--muted)'}"></span>
          <div>
            <div>${escapeHtml(entry.varietyLabel || 'Sans variété')}</div>
            <div class="history__meta">${escapeHtml(meta)}</div>
            ${entry.note ? `<div class="history__meta">${escapeHtml(entry.note)}</div>` : ''}
          </div>
        </div>`;
    })
    .join('');
  box.innerHTML = `<h3>Historique</h3>${items}`;
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

/* --------------------------------------------------------------- légende */

function renderLegend() {
  const list = $('legend-list');
  list.replaceChildren(
    ...state.varieties.map((variety) => {
      const li = document.createElement('li');
      li.className = [
        'legend__item',
        variety.id === state.quickfillVarietyId ? 'legend__item--active' : '',
        variety.archived ? 'legend__item--archived' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'legend__pick';
      pick.innerHTML = `
        <span class="legend__swatch" style="background:${variety.color}"></span>
        <span class="legend__num">${variety.number ?? ''}</span>
        <span class="legend__name">${escapeHtml(variety.name)}</span>
        <span class="legend__count">${variety.inUse}</span>`;
      pick.addEventListener('click', () => {
        state.quickfillVarietyId = state.quickfillVarietyId === variety.id ? null : variety.id;
        renderLegend();
        renderQuickfill();
        renderPlan();
        if (state.quickfillVarietyId) closeSheet('legend-sheet');
      });

      const tools = document.createElement('div');
      tools.className = 'legend__tools';

      const color = document.createElement('input');
      color.type = 'color';
      color.value = variety.color;
      color.style.width = '34px';
      color.style.height = '32px';
      color.title = 'Couleur';
      color.addEventListener(
        'change',
        run(async () => {
          await api(`/varieties/${variety.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ color: color.value }),
          });
          await load();
          renderLegend();
        }),
      );

      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'btn btn--icon';
      rename.textContent = '✎';
      rename.title = 'Renommer';
      rename.addEventListener(
        'click',
        run(async () => {
          const name = window.prompt('Nom de la variété', variety.name);
          if (name === null) return;
          await api(`/varieties/${variety.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
          });
          await load();
          renderLegend();
        }),
      );

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--icon';
      remove.textContent = '🗑';
      remove.title = variety.archived ? 'Réactiver' : 'Supprimer';
      remove.addEventListener(
        'click',
        run(async () => {
          if (variety.archived) {
            await api(`/varieties/${variety.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ archived: false }),
            });
          } else {
            if (!window.confirm(`Supprimer « ${variety.name} » de la légende ?`)) return;
            const result = await api(`/varieties/${variety.id}`, { method: 'DELETE' });
            if (result?.archived) {
              toast('Variété archivée : elle est encore utilisée dans l’historique.');
            }
          }
          if (state.quickfillVarietyId === variety.id) state.quickfillVarietyId = null;
          await load();
          renderLegend();
        }),
      );

      tools.append(color, rename, remove);
      li.append(pick, tools);
      return li;
    }),
  );
}

/* ------------------------------------------------------------------ bacs */

function renderTrayList() {
  const list = $('tray-list');
  list.replaceChildren(
    ...state.trays.map((tray) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = tray.name;

      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'btn btn--icon';
      rename.textContent = '✎';
      rename.title = 'Renommer';
      rename.addEventListener(
        'click',
        run(async () => {
          const value = window.prompt('Nom du bac', tray.name);
          if (value === null) return;
          await api(`/trays/${tray.id}`, { method: 'PATCH', body: JSON.stringify({ name: value }) });
          await load();
          renderTrayList();
        }),
      );

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--icon';
      remove.textContent = '🗑';
      remove.title = 'Supprimer';
      remove.disabled = state.trays.length <= 1;
      remove.addEventListener(
        'click',
        run(async () => {
          if (!window.confirm(`Supprimer le bac « ${tray.name} » et tout son historique ?`)) return;
          await api(`/trays/${tray.id}`, { method: 'DELETE' });
          if (state.tray?.id === tray.id) state.tray = null;
          await load();
          renderTrayList();
        }),
      );

      li.append(name, rename, remove);
      return li;
    }),
  );
}

/* -------------------------------------------------------------- panneaux */

function openSheet(id) {
  hideTooltip();
  $(id).hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeSheet(id) {
  $(id).hidden = true;
  if (id === 'cell-sheet') {
    state.selectedCellId = null;
    renderPlan();
  }
  if (id === 'guide-sheet') {
    state.pickingForCellId = null;
  }
  if (!document.querySelector('.sheet:not([hidden])')) document.body.style.overflow = '';
}

for (const sheet of document.querySelectorAll('.sheet')) {
  sheet.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) closeSheet(sheet.id);
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const open = document.querySelector('.sheet:not([hidden])');
  if (open) closeSheet(open.id);
});

/* ------------------------------------------------------------ évènements */

$('plan').addEventListener('click', (event) => {
  const group = event.target.closest('.hole');
  if (!group) return;
  const cell = cellById(Number(group.dataset.cell));
  if (!cell) return;
  if (state.quickfillVarietyId) applyQuickfill(cell);
  else openCellSheet(cell);
});

$('plan').addEventListener('pointerover', (event) => {
  // Souris uniquement : au doigt, un appui ouvre deja la fiche du trou.
  if (event.pointerType === 'touch' || !canHover()) return;
  const group = event.target.closest('.hole');
  if (!group) return;
  const cell = cellById(Number(group.dataset.cell));
  if (!cell) return;
  const tip = $('tip');
  tip.innerHTML = tooltipHtml(cell);
  tip.hidden = false;
  moveTooltip(event);
});

$('plan').addEventListener('pointermove', (event) => {
  if (!$('tip').hidden) moveTooltip(event);
});

$('plan').addEventListener('pointerout', (event) => {
  // Ne pas masquer quand on passe d'un element a l'autre du meme trou.
  if (event.relatedTarget?.closest?.('.hole') === event.target.closest('.hole')) return;
  hideTooltip();
});

// Filet de securite : re-rendu, defilement ou ouverture d'un panneau.
window.addEventListener('scroll', hideTooltip, { passive: true });

$('plan').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const group = event.target.closest('.hole');
  if (!group) return;
  event.preventDefault();
  group.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

$('tray-select').addEventListener(
  'change',
  run(async (event) => {
    await load(Number(event.target.value));
  }),
);

$('btn-legend').addEventListener('click', () => {
  renderLegend();
  openSheet('legend-sheet');
});

$('btn-tray-menu').addEventListener('click', () => {
  renderTrayList();
  openSheet('tray-sheet');
});

$('btn-guide').addEventListener(
  'click',
  run(async () => {
    state.pickingForCellId = null;
    await loadPlants();
    $('guide-search').value = '';
    renderGuide();
    openSheet('guide-sheet');
  }),
);

$('btn-pick-plant').addEventListener(
  'click',
  run(async () => {
    state.pickingForCellId = state.selectedCellId;
    await loadPlants();
    $('guide-search').value = '';
    renderGuide();
    openSheet('guide-sheet');
  }),
);

$('guide-search').addEventListener('input', renderGuide);

$('guide-list').addEventListener('click', (event) => {
  const favBtn = event.target.closest('[data-fav-key]');
  if (favBtn) {
    toggleFavorite(favBtn.dataset.favKey);
    return;
  }
  const chooseBtn = event.target.closest('.guide__choose');
  if (chooseBtn) choosePlantForCell(chooseBtn.dataset.key);
});

$('quickfill-stop').addEventListener('click', () => {
  state.quickfillVarietyId = null;
  renderQuickfill();
  renderPlan();
});

$('f-sown').addEventListener('change', () => {
  updateAge();
  renderPlantInfo();
});

$('f-variety').addEventListener('change', () => {
  if ($('f-variety').value && !$('f-sown').value) {
    $('f-sown').value = today();
    updateAge();
  }
  renderPlantInfo();
});

$('cell-form').addEventListener(
  'submit',
  run(async (event) => {
    event.preventDefault();
    const cell = cellById(state.selectedCellId);
    if (!cell) return;

    const varietyId = $('f-variety').value;
    if (!varietyId && !$('f-note').value.trim()) {
      // Aucune variete ni note : on considere que l'utilisateur veut vider le trou.
      if (cell.planting) {
        await api(`/cells/${cell.id}/clear`, {
          method: 'POST',
          body: JSON.stringify({ outcome: 'abandon' }),
        });
      }
      closeSheet('cell-sheet');
      await load();
      toast(`${cellLabel(cell)} vidé`);
      return;
    }

    await api(`/cells/${cell.id}/planting`, {
      method: 'PUT',
      body: JSON.stringify({
        varietyId: varietyId || null,
        sownOn: $('f-sown').value || null,
        status: $('f-status').value,
        note: $('f-note').value,
      }),
    });
    closeSheet('cell-sheet');
    await load();
    toast(`${cellLabel(cell)} enregistré`);
  }),
);

function showClearChoices(visible) {
  $('cell-actions').hidden = visible;
  $('clear-choices').hidden = !visible;
}

$('btn-clear').addEventListener('click', () => showClearChoices(true));
$('btn-clear-cancel').addEventListener('click', () => showClearChoices(false));

for (const button of document.querySelectorAll('#clear-choices [data-outcome]')) {
  button.addEventListener(
    'click',
    run(async () => {
      const cell = cellById(state.selectedCellId);
      if (!cell) return;
      const outcome = button.dataset.outcome;
      await api(`/cells/${cell.id}/clear`, {
        method: 'POST',
        body: JSON.stringify({ outcome, endedOn: today() }),
      });
      closeSheet('cell-sheet');
      await load();
      toast(`${cellLabel(cell)} vidé (${OUTCOME_LABELS[outcome].toLowerCase()})`);
    }),
  );
}

$('legend-form').addEventListener(
  'submit',
  run(async (event) => {
    event.preventDefault();
    const name = $('l-name').value.trim();
    if (!name) return;
    await api('/varieties', {
      method: 'POST',
      body: JSON.stringify({ name, color: $('l-color').value }),
    });
    $('l-name').value = '';
    await load();
    renderLegend();
    toast('Variété ajoutée');
  }),
);

$('t-source').addEventListener('change', () => {
  const source = $('t-source').value;
  $('t-grid-size').hidden = source !== 'grid';
  $('t-tower-size').hidden = source !== 'tower';
});

$('tray-form').addEventListener(
  'submit',
  run(async (event) => {
    event.preventDefault();
    const created = await api('/trays', {
      method: 'POST',
      body: JSON.stringify({
        name: $('t-name').value.trim(),
        source: $('t-source').value,
        copyFrom: state.tray?.id,
        rows: Number($('t-rows').value),
        cols: Number($('t-cols').value),
        tiers: Number($('t-tiers').value),
        potsPerTier: Number($('t-pots').value),
      }),
    });
    $('t-name').value = '';
    closeSheet('tray-sheet');
    await load(created.id);
    toast(`Bac « ${created.name} » créé`);
  }),
);

/* -------------------------------------------------------------------- thème */

const THEME_CYCLE = ['system', 'light', 'dark'];
const THEME_ICON = { system: '🌓', light: '☀️', dark: '🌙' };
const THEME_TITLE = {
  system: "Thème : suit l'appareil",
  light: 'Thème : clair',
  dark: 'Thème : sombre',
};

function applyTheme(theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const button = $('theme-toggle');
  button.textContent = THEME_ICON[theme];
  button.title = THEME_TITLE[theme];
}

function setTheme(theme) {
  localStorage.setItem('bouture.theme', theme);
  applyTheme(theme);
}

$('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.dataset.theme ?? 'system';
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
  setTheme(next);
});

applyTheme(document.documentElement.dataset.theme ?? 'system');

/* ---------------------------------------------------------------- démarrage */

run(load)();
// Chargee en arriere-plan, sans bloquer l'affichage du plan : la fiche
// technique d'un pot reste simplement vide tant que ce n'est pas fini.
run(loadPlants)();
