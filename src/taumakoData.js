export const TAUMAKO = { lng: 167.179513, lat: -9.876227 };
export const VANUATU = { lng: 166.96, lat: -15.52 };
export const VOYAGE_FRACTION = 0.2;
export const VOYAGE_POSITION = {
  lng: TAUMAKO.lng + (VANUATU.lng - TAUMAKO.lng) * VOYAGE_FRACTION,
  lat: TAUMAKO.lat + (VANUATU.lat - TAUMAKO.lat) * VOYAGE_FRACTION,
};

export const mapView = {
  center: [168.117371, -15.164366],
  zoom: 6.919,
  pitch: 85,
  bearing: 169.32,
  roll: 0,
  fov: 36.87,
};

export const islandFeatures = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'TAUMAKO', size: 1.15 },
      geometry: { type: 'Point', coordinates: [TAUMAKO.lng, TAUMAKO.lat] },
    },
    {
      type: 'Feature',
      properties: { name: 'Anuta', size: 0.72 },
      geometry: { type: 'Point', coordinates: [169.85, -11.61] },
    },
    {
      type: 'Feature',
      properties: { name: 'Tikopia', size: 0.78 },
      geometry: { type: 'Point', coordinates: [168.83, -12.3] },
    },
    {
      type: 'Feature',
      properties: { name: 'Torres Is.', size: 0.64 },
      geometry: { type: 'Point', coordinates: [166.65, -13.25] },
    },
    {
      type: 'Feature',
      properties: { name: 'SANTOS\nVanuatu', size: 0.95 },
      geometry: { type: 'Point', coordinates: [VANUATU.lng, VANUATU.lat] },
    },
    {
      type: 'Feature',
      properties: { name: 'Vanikoro', size: 0.7 },
      geometry: { type: 'Point', coordinates: [166.93, -11.65] },
    },
    {
      type: 'Feature',
      properties: { name: 'Uturoa', size: 0.62 },
      geometry: { type: 'Point', coordinates: [166.54, -11.27] },
    },
    {
      type: 'Feature',
      properties: { name: 'Reef Is.', size: 0.68 },
      geometry: { type: 'Point', coordinates: [166.310809, -10.230384] },
    },
    {
      type: 'Feature',
      properties: { name: 'Nendo', size: 0.86 },
      geometry: { type: 'Point', coordinates: [165.8, -10.72] },
    },
  ],
};

export const routeFeature = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Taumako to Vanuatu' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [TAUMAKO.lng, TAUMAKO.lat],
          [VANUATU.lng, VANUATU.lat],
        ],
      },
    },
  ],
};

export const namedStars = {
  acrux: { id: 'HIP60718', name: 'Acrux', ra: 12.443311, dec: -63.099092, mag: 0.77 },
  mimosa: { id: 'HIP62434', name: 'Mimosa', ra: 12.795359, dec: -59.688764, mag: 1.25 },
  gacrux: { id: 'HIP61084', name: 'Gacrux', ra: 12.519429, dec: -57.113212, mag: 1.59 },
  imai: { id: 'HIP59747', name: 'Imai', ra: 12.252427, dec: -58.748928, mag: 2.79 },
  ginan: { id: 'HIP60260', name: 'Ginan', ra: 12.356031, dec: -60.401147, mag: 3.59 },
  rigilKentaurus: { id: 'HIP71683', name: 'Rigil Kentaurus', ra: 14.660765, dec: -60.833976, mag: -0.01 },
  hadar: { id: 'HIP68702', name: 'Hadar', ra: 14.063729, dec: -60.373039, mag: 0.61 },
  mintaka: { id: 'HIP25930', name: 'Mintaka', ra: 5.533445, dec: -0.299092, mag: 2.25 },
  alnilam: { id: 'HIP26311', name: 'Alnilam', ra: 5.603559, dec: -1.20192, mag: 1.69 },
  alnitak: { id: 'HIP26727', name: 'Alnitak', ra: 5.679313, dec: -1.942572, mag: 1.74 },
  betelgeuse: { id: 'HIP27989', name: 'Betelgeuse', ra: 5.919529, dec: 7.407063, mag: 0.45 },
  bellatrix: { id: 'HIP25336', name: 'Bellatrix', ra: 5.418851, dec: 6.349702, mag: 1.64 },
  rigel: { id: 'HIP24436', name: 'Rigel', ra: 5.242298, dec: -8.20164, mag: 0.18 },
  saiph: { id: 'HIP27366', name: 'Saiph', ra: 5.795941, dec: -9.669605, mag: 2.07 },
  sirius: { id: 'HIP32349', name: 'Sirius', ra: 6.752481, dec: -16.716116, mag: -1.44 },
  canopus: { id: 'HIP30438', name: 'Canopus', ra: 6.399195, dec: -52.69566, mag: -0.62 },
  procyon: { id: 'HIP37279', name: 'Procyon', ra: 7.655033, dec: 5.224993, mag: 0.4 },
  antares: { id: 'HIP80763', name: 'Antares', ra: 16.490128, dec: -26.432002, mag: 1.06 },
  shaula: { id: 'HIP85927', name: 'Shaula', ra: 17.560145, dec: -37.103821, mag: 1.62 },
  lesath: { id: 'HIP85696', name: 'Lesath', ra: 17.512732, dec: -37.295811, mag: 2.7 },
  alcyone: { id: 'HIP17702', name: 'Alcyone', ra: 3.79141, dec: 24.105137, mag: 2.85 },
  atlas: { id: 'HIP17847', name: 'Atlas', ra: 3.819373, dec: 24.053415, mag: 3.62 },
  electra: { id: 'HIP17499', name: 'Electra', ra: 3.747927, dec: 24.113339, mag: 3.72 },
  maia: { id: 'HIP17573', name: 'Maia', ra: 3.763779, dec: 24.367748, mag: 3.87 },
  merope: { id: 'HIP17608', name: 'Merope', ra: 3.772104, dec: 23.948358, mag: 4.14 },
  taygeta: { id: 'HIP17531', name: 'Taygeta', ra: 3.75347, dec: 24.467278, mag: 4.3 },
  pleione: { id: 'HIP17851', name: 'Pleione', ra: 3.819782, dec: 24.136712, mag: 5.05 },
  celaeno: { id: 'HIP17489', name: 'Celaeno', ra: 3.746726, dec: 24.28947, mag: 5.45 },
  asterope: { id: 'HIP17579', name: 'Asterope', ra: 3.765132, dec: 24.554511, mag: 5.76 },
};

const star = (key) => ({ key, ...namedStars[key] });

export const constellations = [
  {
    id: 'kaua-kona',
    name: 'Kaua Kona',
    association: 'Southern Cross / Crux',
    wind: 'Lae Te Matangi; no special wind',
    stars: [
      star('gacrux'),
      star('acrux'),
      star('mimosa'),
      star('imai'),
      star('ginan'),
    ],
    lines: [
      [0, 1],
      [2, 3],
    ],
  },
  {
    id: 'luonai',
    name: "Luona'i",
    association: 'Pointer stars of the Southern Cross',
    wind: 'One day of strong wind from any or variable direction',
    stars: [
      star('rigilKentaurus'),
      star('hadar'),
    ],
    lines: [[0, 1]],
  },
  {
    id: 'takelo',
    name: 'Takelo',
    association: "Orion's Belt",
    wind: 'Nga Akahu Lua; starts when Takelo sets',
    stars: [
      star('mintaka'),
      star('alnilam'),
      star('alnitak'),
    ],
    lines: [
      [0, 1],
      [1, 2],
    ],
  },
  {
    id: 'hakangi',
    name: 'Hakangi',
    association: "Orion's shoulders",
    wind: 'Te Angeho aanga langi lima ma kona; strong westerlies for five days',
    stars: [
      star('bellatrix'),
      star('betelgeuse'),
    ],
    lines: [[0, 1]],
  },
  {
    id: 'lolei',
    name: 'Lolei',
    association: "Orion's knees",
    wind: 'Orion lower-star asterism',
    stars: [
      star('rigel'),
      star('saiph'),
    ],
    lines: [[0, 1]],
  },
  {
    id: 'sino',
    name: 'Sino',
    association: 'Sirius / body of Manu',
    wind: 'Lae Te Matangi; no special wind',
    stars: [star('sirius')],
    lines: [],
  },
  {
    id: 'nga-papakau',
    name: 'Nga Papakau',
    association: 'Canopus and Procyon',
    wind: 'Wings of Manu',
    stars: [
      star('canopus'),
      star('procyon'),
    ],
    lines: [],
  },
  {
    id: 'salo-lavoi',
    name: 'Salo Lavoi',
    association: 'Antares in Scorpius',
    wind: 'Lae Te Matangi; no special wind',
    stars: [star('antares')],
    lines: [],
  },
  {
    id: 'kilika',
    name: 'Kilika',
    association: 'Tail of Scorpius',
    wind: 'Lae Te Matangi me Kona; no strong wind',
    stars: [
      star('lesath'),
      star('shaula'),
    ],
    lines: [[0, 1]],
  },
  {
    id: 'hetu-mdavo',
    name: 'Hetu Mdavo',
    association: 'Pleiades',
    wind: 'Nga Langi Lima I Te Angeho; five days of westerlies',
    stars: [
      star('alcyone'),
      star('atlas'),
      star('electra'),
      star('maia'),
      star('merope'),
      star('taygeta'),
      star('pleione'),
      star('celaeno'),
      star('asterope'),
    ],
    lines: [],
  },
];
