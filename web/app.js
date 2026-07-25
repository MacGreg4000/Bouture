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
};

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
  const data = await api(`/state${target ? `?tray=${target}` : ''}`);
  state.trays = data.trays;
  state.tray = data.tray;
  state.cells = data.cells;
  state.varieties = data.varieties;
  state.holeRadius = data.holeRadius;
  if (state.tray) localStorage.setItem('bouture.tray', String(state.tray.id));
  renderAll();
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
  const chips = [
    `<b>${counters.occupied}</b> / ${counters.total} trous occupés`,
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
  hideTooltip(); // les trous survoles vont etre remplaces
  svg.replaceChildren();
  if (!state.tray) return;

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
  const lines = [`<b>Trou ${cell.position}</b>`];

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
  if (!cell.planting) return `Trou ${cell.position} — vide`;
  const age = daysSince(cell.planting.sownOn);
  const parts = [
    `Trou ${cell.position}`,
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
    $('hint').textContent = canHover()
      ? 'Survole un trou pour voir son contenu, clique pour le modifier.'
      : 'Touche un trou pour renseigner ce que tu y as mis.';
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
  toast(`Trou ${cell.position} → ${variety.name}`);
});

/* ----------------------------------------------------------- fiche du trou */

function openCellSheet(cell) {
  state.selectedCellId = cell.id;
  renderPlan();

  $('cell-title').textContent = `Trou ${cell.position}`;

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

  $('btn-clear').hidden = !cell.planting;
  showClearChoices(false);
  renderHistory(cell);
  openSheet('cell-sheet');
}

function updateAge() {
  const age = daysSince($('f-sown').value);
  $('f-age').textContent = age === null ? '' : age === 0 ? 'Semé aujourd’hui.' : `Semé il y a ${age} jour${age > 1 ? 's' : ''}.`;
}

const renderHistory = run(async (cell) => {
  const box = $('history');
  if (!cell.historyCount) {
    box.innerHTML = '<h3>Historique</h3><p class="history__empty">Aucun cycle terminé pour ce trou.</p>';
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

$('quickfill-stop').addEventListener('click', () => {
  state.quickfillVarietyId = null;
  renderQuickfill();
  renderPlan();
});

$('f-sown').addEventListener('change', updateAge);

$('f-variety').addEventListener('change', () => {
  if ($('f-variety').value && !$('f-sown').value) {
    $('f-sown').value = today();
    updateAge();
  }
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
      toast(`Trou ${cell.position} vidé`);
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
    toast(`Trou ${cell.position} enregistré`);
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
      toast(`Trou ${cell.position} vidé (${OUTCOME_LABELS[outcome].toLowerCase()})`);
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
  $('t-grid-size').hidden = $('t-source').value !== 'grid';
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
      }),
    });
    $('t-name').value = '';
    closeSheet('tray-sheet');
    await load(created.id);
    toast(`Bac « ${created.name} » créé`);
  }),
);

/* ---------------------------------------------------------------- démarrage */

run(load)();
