/**
 * Base de référence des légumes/aromates courants, écrite une fois pour
 * toutes dans le code (aucun appel réseau ni dépendance à un service d'IA
 * au moment de l'utilisation — l'app fonctionne hors ligne, sur le réseau
 * local).
 *
 * Les valeurs (pH, EC, jours de culture) sont des repères indicatifs issus
 * de la littérature horticole générale, pas des mesures garanties : elles
 * varient selon la variété exacte, la saison et les conditions réelles de
 * la tour. `daysMin`/`daysMax` compte les jours entre le semis/repiquage et
 * la première récolte.
 *
 * Pour corriger ou compléter une fiche : modifie directement PLANTS
 * ci-dessous, puis redémarre le serveur (aucune migration nécessaire, cette
 * liste n'est pas stockée en base).
 */

export const SUITABILITY = {
  adapted: { label: 'Bien adaptée en tour', order: 0 },
  limited: { label: 'Possible, avec réserve', order: 1 },
  not_recommended: { label: 'Peu adaptée en tour', order: 2 },
};

export const PLANTS = [
  // ------------------------------------------------------------- feuilles
  { key: 'laitue-batavia', name: 'Laitue Batavia', aliases: ['laitue batavia', 'batavia', 'laitue', 'lettuce'], category: 'Feuille', suitability: 'adapted', light: '12–16 h/j', ph: '5.5–6.5', ec: '1.2–1.8 mS/cm', daysMin: 30, daysMax: 45, tip: 'Récolte feuille à feuille pour prolonger la production plutôt que couper toute la tête.' },
  { key: 'laitue-feuille-de-chene', name: 'Laitue feuille de chêne', aliases: ['laitue feuille de chene', 'feuille de chene', 'feuille de chêne', 'oak leaf lettuce'], category: 'Feuille', suitability: 'adapted', light: '12–16 h/j', ph: '5.5–6.5', ec: '1.2–1.8 mS/cm', daysMin: 30, daysMax: 40, tip: 'Ne pomme pas : se récolte en feuilles au fur et à mesure, sans attendre une taille précise.' },
  { key: 'laitue-beurre', name: 'Laitue beurre (butterhead)', aliases: ['laitue beurre', 'butterhead', 'boston lettuce'], category: 'Feuille', suitability: 'adapted', light: '12–16 h/j', ph: '5.5–6.5', ec: '1.2–1.8 mS/cm', daysMin: 35, daysMax: 50, tip: 'Pomme souple et tendre ; l\'une des plus cultivées en systèmes hydroponiques commerciaux.' },
  { key: 'laitue-lollo-rossa', name: 'Laitue lollo rossa/bionda', aliases: ['lollo rossa', 'lollo bionda', 'laitue frisee', 'laitue frisée'], category: 'Feuille', suitability: 'adapted', light: '12–16 h/j', ph: '5.5–6.5', ec: '1.2–1.8 mS/cm', daysMin: 30, daysMax: 45, tip: 'Feuilles très frisées, surtout décoratives et productives en récolte continue.' },
  { key: 'salade-romaine', name: 'Salade romaine', aliases: ['romaine', 'salade romaine', 'cos'], category: 'Feuille', suitability: 'adapted', light: '12–16 h/j', ph: '5.5–6.5', ec: '1.2–1.8 mS/cm', daysMin: 45, daysMax: 60, tip: 'Plus lente que la laitue à pommer ; garder un bon espacement entre pots voisins.' },
  { key: 'iceberg', name: 'Iceberg', aliases: ['iceberg'], category: 'Feuille', suitability: 'limited', light: '12–16 h/j', ph: '5.5–6.5', ec: '1.2–1.8 mS/cm', daysMin: 60, daysMax: 75, tip: 'Pomme compacte plus longue à former ; en tour, préférer une récolte en feuilles avant pommaison complète.' },
  { key: 'pak-choi', name: 'Chou pak-choi (bok choy)', aliases: ['pak choi', 'pak-choi', 'bok choy', 'chou chinois'], category: 'Feuille', suitability: 'adapted', light: '12–14 h/j', ph: '6.0–7.0', ec: '1.8–2.3 mS/cm', daysMin: 35, daysMax: 45, tip: 'Rapide et compact pour un chou : l\'un des mieux adaptés à la tour dans cette famille.' },
  { key: 'roquette', name: 'Roquette', aliases: ['roquette', 'arugula', 'rucola'], category: 'Feuille', suitability: 'adapted', light: '10–14 h/j', ph: '6.0–7.0', ec: '0.8–1.8 mS/cm', daysMin: 25, daysMax: 35, tip: 'Très rapide : ressemer un pot toutes les 2-3 semaines pour une récolte continue.' },
  { key: 'epinard', name: 'Épinard', aliases: ['epinard', 'épinard', 'spinach'], category: 'Feuille', suitability: 'adapted', light: '10–14 h/j', ph: '6.0–7.0', ec: '1.8–2.3 mS/cm', daysMin: 35, daysMax: 45, tip: "Monte en graine vite par forte chaleur ; préférer une exposition plus fraîche en été." },
  { key: 'mache', name: 'Mâche', aliases: ['mache', 'mâche', 'doucette'], category: 'Feuille', suitability: 'adapted', light: '10–12 h/j', ph: '6.0–7.0', ec: '1.2–1.8 mS/cm', daysMin: 40, daysMax: 50, tip: 'Apprécie la fraîcheur ; bon choix pour la saison froide sous la lampe.' },
  { key: 'kale', name: 'Chou kale (frisé)', aliases: ['kale', 'chou frise', 'chou frisé'], category: 'Feuille', suitability: 'adapted', light: '12–16 h/j', ph: '5.5–6.5', ec: '1.8–2.4 mS/cm', daysMin: 55, daysMax: 65, tip: 'Récolte possible dès 30 jours en feuilles jeunes ; les feuilles basses se reprennent après coupe.' },
  { key: 'blette', name: 'Blette (bette à carde)', aliases: ['blette', 'bette a carde', 'bette à carde', 'poiree', 'poirée'], category: 'Feuille', suitability: 'adapted', light: '12–14 h/j', ph: '6.0–6.5', ec: '1.8–2.3 mS/cm', daysMin: 50, daysMax: 60, tip: 'Robuste et productive ; récolter les feuilles externes en laissant le cœur pousser.' },
  { key: 'cresson', name: 'Cresson', aliases: ['cresson'], category: 'Feuille', suitability: 'adapted', light: '10–14 h/j', ph: '6.5–7.5', ec: '0.8–1.6 mS/cm', daysMin: 20, daysMax: 30, tip: 'Très rapide, aime beaucoup d\'eau : vérifier que le pot ne sèche jamais.' },

  // --------------------------------------------------------------- choux
  { key: 'chou-rouge', name: 'Chou rouge', aliases: ['chou rouge'], category: 'Chou', suitability: 'limited', light: '12–16 h/j', ph: '6.0–6.5', ec: '2.0–2.5 mS/cm', daysMin: 70, daysMax: 90, tip: 'Plante volumineuse : réserver un pot isolé, elle gênera vite ses voisins directs.' },
  { key: 'chou-bruxelles', name: 'Chou de Bruxelles', aliases: ['chou de bruxelles', 'choux de bruxelles'], category: 'Chou', suitability: 'limited', light: '12–16 h/j', ph: '6.0–6.5', ec: '2.0–2.5 mS/cm', daysMin: 90, daysMax: 110, tip: 'Cycle long et plante haute et lourde : parmi les moins adaptées à une tour verticale.' },
  { key: 'chou-fleur', name: 'Chou-fleur', aliases: ['chou fleur', 'chou-fleur'], category: 'Chou', suitability: 'limited', light: '12–16 h/j', ph: '6.0–6.5', ec: '2.0–2.5 mS/cm', daysMin: 70, daysMax: 85, tip: 'Très encombrant à maturité ; prévoir beaucoup d\'espace autour du pot.' },
  { key: 'brocoli', name: 'Brocoli', aliases: ['brocoli', 'brocolis'], category: 'Chou', suitability: 'limited', light: '12–16 h/j', ph: '6.0–6.5', ec: '2.0–2.5 mS/cm', daysMin: 60, daysMax: 80, tip: 'Après la tête principale, de petites pousses latérales continuent à produire quelques semaines.' },
  { key: 'chou-rave', name: 'Chou-rave', aliases: ['chou rave', 'chou-rave', 'kohlrabi'], category: 'Chou', suitability: 'adapted', light: '12–14 h/j', ph: '6.0–6.5', ec: '1.8–2.2 mS/cm', daysMin: 50, daysMax: 60, tip: 'Plus compact que les autres choux : un des mieux adaptés à la tour.' },

  // ------------------------------------------------------------ aromates
  { key: 'basilic', name: 'Basilic', aliases: ['basilic', 'basil'], category: 'Aromate', suitability: 'adapted', light: '14–18 h/j', ph: '5.5–6.5', ec: '1.0–1.6 mS/cm', daysMin: 25, daysMax: 30, tip: 'Pincer régulièrement les fleurs naissantes pour prolonger la production de feuilles.' },
  { key: 'persil', name: 'Persil', aliases: ['persil', 'parsley'], category: 'Aromate', suitability: 'adapted', light: '10–14 h/j', ph: '6.0–7.0', ec: '1.2–1.8 mS/cm', daysMin: 60, daysMax: 70, tip: 'Germination lente (2-3 semaines) : ne pas s\'inquiéter d\'un démarrage qui traîne.' },
  { key: 'ciboulette', name: 'Ciboulette', aliases: ['ciboulette', 'chives'], category: 'Aromate', suitability: 'adapted', light: '10–14 h/j', ph: '6.0–7.0', ec: '1.2–1.8 mS/cm', daysMin: 55, daysMax: 65, tip: 'Vivace et increvable ; couper au ras du pot, elle repart aussitôt.' },
  { key: 'menthe', name: 'Menthe', aliases: ['menthe', 'mint'], category: 'Aromate', suitability: 'adapted', light: '10–14 h/j', ph: '6.0–7.0', ec: '1.2–2.0 mS/cm', daysMin: 25, daysMax: 35, tip: 'Très envahissante même en pot isolé : ne pas hésiter à la tailler court régulièrement.' },
  { key: 'coriandre', name: 'Coriandre', aliases: ['coriandre', 'cilantro', 'coriander'], category: 'Aromate', suitability: 'limited', light: '10–14 h/j', ph: '6.0–6.8', ec: '1.2–1.8 mS/cm', daysMin: 25, daysMax: 35, tip: 'Monte en graine très vite à la chaleur ou forte lumière : ressemer souvent plutôt qu\'attendre.' },
  { key: 'thym', name: 'Thym', aliases: ['thym', 'thyme'], category: 'Aromate', suitability: 'adapted', light: '12–16 h/j', ph: '6.0–7.0', ec: '0.8–1.6 mS/cm', daysMin: 70, daysMax: 80, tip: 'Installation lente puis vivace des années : un bon pensionnaire permanent de la tour.' },
  { key: 'origan', name: 'Origan', aliases: ['origan', 'oregano'], category: 'Aromate', suitability: 'adapted', light: '12–16 h/j', ph: '6.0–7.0', ec: '0.8–1.6 mS/cm', daysMin: 80, daysMax: 90, tip: 'Comme le thym : lent à démarrer, vivace ensuite.' },
  { key: 'aneth', name: 'Aneth', aliases: ['aneth', 'dill'], category: 'Aromate', suitability: 'adapted', light: '12–16 h/j', ph: '5.5–6.5', ec: '1.0–1.6 mS/cm', daysMin: 40, daysMax: 50, tip: 'Monte en graine à la chaleur, comme la coriandre.' },
  { key: 'estragon', name: 'Estragon', aliases: ['estragon', 'tarragon'], category: 'Aromate', suitability: 'limited', light: '12–16 h/j', ph: '6.0–7.0', ec: '1.2–1.8 mS/cm', daysMin: 60, daysMax: 90, tip: 'Installation lente ; se multiplie mieux par bouture que par graine.' },
  { key: 'sauge', name: 'Sauge', aliases: ['sauge', 'sage'], category: 'Aromate', suitability: 'adapted', light: '12–16 h/j', ph: '6.0–7.0', ec: '0.8–1.6 mS/cm', daysMin: 75, daysMax: 90, tip: 'Comme le thym : installation lente puis vivace, peu gourmande en entretien.' },
  { key: 'romarin', name: 'Romarin', aliases: ['romarin', 'rosemary'], category: 'Aromate', suitability: 'limited', light: '12–16 h/j', ph: '6.0–7.0', ec: '0.8–1.4 mS/cm', daysMin: 90, daysMax: 120, tip: 'Arbrisseau à croissance lente ; devient ligneux et encombrant après une saison ou deux.' },

  // -------------------------------------------------------- fruits/légumes
  { key: 'tomate-cerise', name: 'Tomate cerise', aliases: ['tomate cerise', 'tomate', 'cherry tomato'], category: 'Fruit', suitability: 'adapted', light: '14–18 h/j', ph: '5.5–6.5', ec: '2.0–3.5 mS/cm', daysMin: 60, daysMax: 80, tip: 'Tuteurer tôt vers le haut de la tour ; pincer les gourmands pour limiter l\'encombrement.' },
  { key: 'tomate-roma', name: 'Tomate roma (allongée)', aliases: ['tomate roma', 'roma', 'tomate allongee', 'tomate allongée', 'san marzano'], category: 'Fruit', suitability: 'adapted', light: '14–18 h/j', ph: '5.5–6.5', ec: '2.0–3.5 mS/cm', daysMin: 65, daysMax: 85, tip: 'Moins ramifiée qu\'une cerise ; tuteurer quand même, les fruits sont plus lourds.' },
  { key: 'tomate-naine', name: 'Tomate naine (patio)', aliases: ['tomate naine', 'tomate patio', 'dwarf tomato', 'tomate balcon'], category: 'Fruit', suitability: 'adapted', light: '14–18 h/j', ph: '5.5–6.5', ec: '2.0–3.5 mS/cm', daysMin: 55, daysMax: 70, tip: 'Port compact : souvent la tomate la plus simple à gérer en pot de tour, peu ou pas de tuteur.' },
  { key: 'tomate-grosse', name: 'Grosse tomate (cœur de bœuf, beefsteak…)', aliases: ['coeur de boeuf', 'cœur de bœuf', 'beefsteak', 'tomate grosse', 'tomate marmande'], category: 'Fruit', suitability: 'limited', light: '14–18 h/j', ph: '5.5–6.5', ec: '2.0–3.5 mS/cm', daysMin: 75, daysMax: 90, tip: 'Fruits lourds sur une plante haute : tuteurage solide indispensable, parmi les tomates les plus exigeantes en tour.' },
  { key: 'poivron', name: 'Poivron doux', aliases: ['poivron', 'poivron doux', 'bell pepper', 'lombardie'], category: 'Fruit', suitability: 'adapted', light: '14–18 h/j', ph: '5.5–6.5', ec: '2.0–3.0 mS/cm', daysMin: 70, daysMax: 90, tip: 'Prévoir un tuteur : la plante devient lourde une fois chargée en fruits.' },
  { key: 'piment', name: 'Piment fort', aliases: ['piment', 'piment fort', 'piment oiseau', 'chili', 'chili pepper'], category: 'Fruit', suitability: 'adapted', light: '14–18 h/j', ph: '5.5–6.5', ec: '2.0–3.0 mS/cm', daysMin: 70, daysMax: 100, tip: 'Souvent plus compact qu\'un poivron doux ; bien adapté à un pot de tour.' },
  { key: 'aubergine', name: 'Aubergine', aliases: ['aubergine', 'eggplant'], category: 'Fruit', suitability: 'limited', light: '14–18 h/j', ph: '5.5–6.5', ec: '2.0–3.0 mS/cm', daysMin: 75, daysMax: 95, tip: 'Plante lourde nécessitant un tuteurage solide ; occupe beaucoup de place pour peu de fruits.' },
  { key: 'concombre', name: 'Concombre', aliases: ['concombre', 'cucumber'], category: 'Fruit', suitability: 'adapted', light: '12–16 h/j', ph: '5.5–6.0', ec: '1.7–2.5 mS/cm', daysMin: 50, daysMax: 65, tip: 'Très vigoureux : guider les tiges vers le haut, sinon il envahit les pots voisins.' },
  { key: 'cornichon', name: 'Cornichon', aliases: ['cornichon', 'gherkin', 'pickling cucumber'], category: 'Fruit', suitability: 'adapted', light: '12–16 h/j', ph: '5.5–6.0', ec: '1.7–2.5 mS/cm', daysMin: 45, daysMax: 60, tip: 'Comme le concombre mais fruits plus petits, récoltés jeunes : plante tout aussi vigoureuse à guider.' },
  { key: 'fraise', name: 'Fraise', aliases: ['fraise', 'strawberry'], category: 'Fruit', suitability: 'adapted', light: '12–16 h/j', ph: '5.5–6.5', ec: '1.4–1.8 mS/cm', daysMin: 60, daysMax: 90, tip: 'Légère et compacte : une des cultures fruitières les mieux adaptées à la tour.' },

  // ---------------------------------------------------------------- racines
  { key: 'radis', name: 'Radis', aliases: ['radis', 'radish'], category: 'Racine', suitability: 'adapted', light: '10–14 h/j', ph: '6.0–7.0', ec: '1.2–1.8 mS/cm', daysMin: 25, daysMax: 35, tip: 'Choisir une variété à racine courte/ronde : les longues manquent de profondeur en pot de tour.' },
  { key: 'carotte', name: 'Carotte', aliases: ['carotte', 'carrot'], category: 'Racine', suitability: 'not_recommended', light: '12–14 h/j', ph: '6.0–6.8', ec: '1.6–2.0 mS/cm', daysMin: 70, daysMax: 80, tip: 'Racine profonde peu compatible avec un pot de tour ; à défaut, choisir une variété "boule" courte.' },
  { key: 'betterave', name: 'Betterave', aliases: ['betterave', 'beet'], category: 'Racine', suitability: 'limited', light: '12–14 h/j', ph: '6.0–6.8', ec: '1.8–2.3 mS/cm', daysMin: 55, daysMax: 70, tip: 'Racine moins profonde que la carotte : possible, sans garantie de belle taille.' },
  { key: 'navet', name: 'Navet', aliases: ['navet', 'turnip'], category: 'Racine', suitability: 'limited', light: '12–14 h/j', ph: '6.0–6.8', ec: '1.6–2.0 mS/cm', daysMin: 40, daysMax: 55, tip: 'Racine courte : plus jouable qu\'une carotte en pot de tour.' },
  { key: 'pomme-de-terre', name: 'Pomme de terre', aliases: ['pomme de terre', 'patate', 'potato'], category: 'Racine', suitability: 'not_recommended', light: '12–16 h/j', ph: '5.5–6.5', ec: '2.0–2.5 mS/cm', daysMin: 90, daysMax: 120, tip: 'Tubercules profonds et feuillage envahissant : parmi les moins compatibles avec un pot de tour.' },

  // -------------------------------------------------------------- alliacées
  { key: 'ail', name: 'Ail', aliases: ['ail', 'garlic'], category: 'Bulbe', suitability: 'not_recommended', light: '10–14 h/j', ph: '6.0–7.0', ec: '1.4–1.8 mS/cm', daysMin: 150, daysMax: 240, tip: 'Cycle très long : monopolise un pot pendant des mois pour peu de récolte.' },
  { key: 'oignon-bulbe', name: 'Oignon (bulbe)', aliases: ['oignon', 'onion', 'oignon bulbe'], category: 'Bulbe', suitability: 'not_recommended', light: '10–14 h/j', ph: '6.0–7.0', ec: '1.4–1.8 mS/cm', daysMin: 100, daysMax: 175, tip: 'Cycle long pour former un vrai bulbe ; préférer l\'oignon vert en tour.' },
  { key: 'oignon-vert', name: 'Oignon vert / ciboule', aliases: ['oignon vert', 'ciboule', 'cebette', 'spring onion'], category: 'Bulbe', suitability: 'adapted', light: '10–14 h/j', ph: '6.0–7.0', ec: '1.4–1.8 mS/cm', daysMin: 60, daysMax: 80, tip: 'Récolté en tige (pas en bulbe) : bien plus adapté à la tour qu\'un oignon classique.' },
  { key: 'poireau', name: 'Poireau', aliases: ['poireau', 'leek'], category: 'Bulbe', suitability: 'limited', light: '10–14 h/j', ph: '6.0–7.0', ec: '1.4–2.0 mS/cm', daysMin: 90, daysMax: 120, tip: 'Cycle long et encombrant, mais reste jouable si le pot lui est dédié.' },

  // ---------------------------------------------------------- légumineuses
  { key: 'pois', name: 'Pois mange-tout', aliases: ['pois', 'pois mange-tout', 'snap pea'], category: 'Légumineuse', suitability: 'adapted', light: '12–14 h/j', ph: '6.0–7.0', ec: '1.2–1.8 mS/cm', daysMin: 55, daysMax: 70, tip: 'Grimpant : prévoir un support ou guider les tiges le long de la colonne.' },
  { key: 'haricot-nain', name: 'Haricot nain', aliases: ['haricot nain', 'haricot vert nain', 'bush bean'], category: 'Légumineuse', suitability: 'adapted', light: '12–16 h/j', ph: '6.0–6.5', ec: '1.8–2.2 mS/cm', daysMin: 50, daysMax: 60, tip: 'Plus compact que le haricot à rames : bon choix pour un pot de tour.' },
  { key: 'haricot-rame', name: 'Haricot à rames', aliases: ['haricot a rames', 'haricot à rames', 'pole bean'], category: 'Légumineuse', suitability: 'limited', light: '12–16 h/j', ph: '6.0–6.5', ec: '1.8–2.2 mS/cm', daysMin: 60, daysMax: 70, tip: 'Nécessite un tuteur haut à côté de la tour ; le nain est plus simple à gérer.' },

  // -------------------------------------------------------- cucurbitacées
  { key: 'courgette', name: 'Courgette', aliases: ['courgette', 'zucchini'], category: 'Cucurbitacée', suitability: 'not_recommended', light: '14–18 h/j', ph: '6.0–6.5', ec: '1.8–2.4 mS/cm', daysMin: 45, daysMax: 55, tip: 'Plante très volumineuse : difficilement gérable en pot de tour, sauf variété naine.' },
  { key: 'melon', name: 'Melon', aliases: ['melon'], category: 'Cucurbitacée', suitability: 'not_recommended', light: '14–18 h/j', ph: '6.0–6.5', ec: '1.8–2.4 mS/cm', daysMin: 70, daysMax: 90, tip: 'Plante lourde et très étalée : à réserver à un vrai bac au sol, pas à une tour.' },
];

/** Enlève les accents et met en minuscules, pour un rapprochement tolérant. */
function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marques diacritiques combinantes (accents)
    .toLowerCase()
    .trim();
}

/**
 * Cherche la fiche correspondant le mieux à un nom de variété libre (ex. le
 * nom saisi par l'utilisateur dans la légende). Comparaison tolérante aux
 * accents/casse, sur correspondance exacte puis partielle.
 */
export function matchPlant(varietyName) {
  const needle = normalize(varietyName);
  if (!needle) return null;

  for (const plant of PLANTS) {
    if (plant.aliases.some((alias) => normalize(alias) === needle)) return plant;
  }
  for (const plant of PLANTS) {
    if (plant.aliases.some((alias) => needle.includes(normalize(alias)) || normalize(alias).includes(needle))) {
      return plant;
    }
  }
  return null;
}
