// World Dice: randomness taken from the clock, the calendar, or the grimoire's own lists.
// Values are captured once, when a card is drawn, so the card never changes while you use it.

const WORDS = [
  'lantern', 'comet', 'velvet', 'harbor', 'mosaic', 'ember', 'compass', 'origami', 'tide', 'whisper',
  'labyrinth', 'honey', 'prism', 'orchard', 'telescope', 'feather', 'thunder', 'lighthouse', 'marble', 'saffron',
  'glacier', 'puzzle', 'kite', 'echo', 'meadow', 'clockwork', 'pebble', 'satellite', 'moss', 'carousel',
  'ink', 'lagoon', 'bridge', 'cinnamon', 'ladder', 'nebula', 'quilt', 'anchor', 'orbit', 'canopy',
  'shadow', 'teacup', 'volcano', 'ribbon', 'fossil', 'mirror', 'pendulum', 'driftwood', 'balloon', 'thread',
  'cathedral', 'firefly', 'magnet', 'seashell', 'avalanche', 'blueprint', 'lullaby', 'archipelago', 'garden', 'circus',
  'migration', 'hourglass', 'parachute', 'beehive', 'constellation', 'tunnel', 'jellyfish', 'monsoon', 'bookshelf', 'windmill',
  'paper boat', 'tightrope', 'snowglobe', 'periscope', 'greenhouse', 'raincoat', 'locksmith', 'compost', 'sundial', 'marionette',
];

const COLORS = ['blue', 'green', 'yellow', 'red', 'orange', 'purple', 'pink', 'white', 'black', 'silver', 'gold', 'brown'];

const LISTS = {
  word: WORDS,
  color: COLORS,
  letter: ['e', 'a', 'o', 't', 'i', 'n', 's', 'r'],
  alpha: 'ABCDEFGHIJKLM'.split(''),
  coin: ['heads', 'tails'],
  role: [
    'a medieval blacksmith', 'a beekeeper', 'an air traffic controller', 'a stage magician',
    'a chess grandmaster', 'a pastry chef', 'a deep-sea diver', 'a kindergarten teacher',
    'a lighthouse keeper', 'a jazz drummer', 'a museum curator', 'a mountain rescue guide',
  ],
  genre: [
    'a nature documentary', 'a recipe', 'a weather forecast', 'a breaking news report',
    'a fairy tale', 'an instruction manual', 'a sports commentary', 'a love letter',
  ],
  era: [
    '1920s Paris', 'a 1980s arcade', 'ancient Rome', 'a 1960s space program',
    'a Victorian apothecary', 'the year 2300', 'a Japanese woodblock print shop', 'a 1970s record store',
  ],
  analogy: [
    'a kitchen during dinner rush', "a city's traffic", 'a football match', 'a garden',
    'a post office', 'a theatre production', 'an orchestra', 'a beehive',
  ],
  topic: [
    'bioluminescence', 'the Voynich manuscript', 'tardigrades', 'the history of the fork',
    'the Antikythera mechanism', 'mantis shrimp', 'the Great Emu War', 'lichen',
    'the Library of Alexandria', 'the overview effect', 'glass frogs', 'the Mpemba effect',
    'Esperanto', 'the invention of zero', 'starling murmurations', 'the Svalbard seed vault',
  ],
};

// Where each kind of value came from, for the "Why this card?" panel.
export const DICE_SOURCES = {
  num: 'the clock', few: 'the clock', page: "today's date",
};

export const OPEN = '⟦';  // ⟦
export const CLOSE = '⟧'; // ⟧

const TOKEN_RE = /\{(\w+)\}/g;

function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function tokensIn(texts) {
  const found = new Set();
  for (const t of texts) {
    if (!t) continue;
    for (const m of t.matchAll(TOKEN_RE)) found.add(m[1]);
  }
  return [...found];
}

export function knownToken(name) {
  return name === 'num' || name === 'few' || name === 'page' || Object.prototype.hasOwnProperty.call(LISTS, name);
}

// Roll every token a card uses. `existing` lets an adapted card keep the values it already had.
export function rollDice(names, now, rng, existing = {}) {
  const out = { ...existing };
  const minute = now.getMinutes();
  for (const name of names) {
    if (out[name] !== undefined) continue;
    if (name === 'num') out.num = String((minute % 5) + 1);
    else if (name === 'few') out.few = String((minute % 3) + 1);
    else if (name === 'page') out.page = String(now.getDate());
    else if (LISTS[name]) out[name] = pick(LISTS[name], rng);
  }
  return out;
}

// Replace {tokens} with rolled values, wrapped in markers so the interface can highlight them.
export function applyDice(text, values) {
  if (!text) return text;
  return text.replace(TOKEN_RE, (whole, name) => (values[name] !== undefined ? OPEN + values[name] + CLOSE : whole));
}

export function plain(text) {
  return text ? text.split(OPEN).join('').split(CLOSE).join('') : text;
}

// Split marked text into parts: [{text, dice:boolean}]
export function segments(text) {
  if (!text) return [];
  const parts = [];
  let rest = text;
  while (rest.length) {
    const a = rest.indexOf(OPEN);
    if (a === -1) { parts.push({ text: rest, dice: false }); break; }
    if (a > 0) parts.push({ text: rest.slice(0, a), dice: false });
    const b = rest.indexOf(CLOSE, a + 1);
    if (b === -1) { parts.push({ text: rest.slice(a + 1), dice: false }); break; }
    parts.push({ text: rest.slice(a + 1, b), dice: true });
    rest = rest.slice(b + 1);
  }
  return parts;
}
