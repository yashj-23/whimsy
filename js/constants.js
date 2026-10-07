// Shared vocabulary for Whimsy. Labels are what the person sees; keys are what the engine uses.

export const APP_VERSION = '1.0.0';

export const MODES = {
  stuck: { label: 'Get unstuck', short: 'Unstuck' },
  bored: { label: 'Surprise me', short: 'Surprise' },
};

export const CATEGORIES = {
  code:     { label: 'Code',                 color: '#3D7BFF' },
  writing:  { label: 'Writing',              color: '#A04BFF' },
  design:   { label: 'Design',               color: '#FF6A3D' },
  thinking: { label: 'Thinking & decisions', short: 'Thinking', color: '#FFB41A' },
  learning: { label: 'Learning',             color: '#16BE78' },
};

export const SNAGS = {
  unsure:  { label: 'Not sure',            hint: 'Something feels off' },
  start:   { label: "Can't start",         hint: 'The blank page wins' },
  options: { label: 'Too many options',    hint: 'Everything looks possible' },
  angle:   { label: 'Need a fresh angle',  hint: 'Same ideas on repeat' },
  broken:  { label: "Something's broken",  hint: "It doesn't work and I don't know why" },
  finish:  { label: "Can't finish",        hint: 'Polishing instead of shipping' },
};

export const INTENTS = {
  any:     { label: 'Anything',       color: '#FF4FA3' },
  make:    { label: 'Make something', color: '#FF8A1F' },
  explore: { label: 'Explore',        color: '#19BFE3' },
  reset:   { label: 'Reset',          color: '#7B83FF' },
};

export const TIMES = [2, 5, 15, 25, 60];

export const ENERGY = {
  1: { label: 'Low energy' },
  2: { label: 'Normal energy' },
  3: { label: 'High energy' },
};

export const SETTINGS = {
  desk: { label: 'At my desk' },
  home: { label: 'At home' },
  out:  { label: 'Out and about' },
};

export const WEIRD = {
  1:      { label: 'Nudge',  hint: 'Mild and useful',            color: '#F0866A' },
  2:      { label: 'Twist',  hint: 'Uncomfortable but doable',   color: '#E5506A' },
  3:      { label: 'Absurd', hint: 'Ridiculous on purpose',      color: '#C42F86' },
  fate:   { label: 'Fate',   hint: 'Three coins decide',         color: '#C98A1E' },
};

export const EFFORT = {
  1: 'Light effort',
  2: 'Some effort',
  3: 'Full effort',
};

export const FLAVORS = {
  subtract:    { label: 'Take something away', plural: 'Take-away' },
  invert:      { label: 'Flip it',             plural: 'Flip-it' },
  substitute:  { label: 'Swap it',             plural: 'Swap-it' },
  squeeze:     { label: 'Squeeze it',          plural: 'Squeeze' },
  perspective: { label: 'New eyes',            plural: 'New-eyes' },
  dice:        { label: 'World dice',          plural: 'World-dice' },
  body:        { label: 'Move',                plural: 'Movement' },
  reframe:     { label: 'Reframe',             plural: 'Reframe' },
};

// Requirements a card can have, and the comfort rule that blocks each one.
export const NEEDS = {
  outside: { rule: 'Never ask me to go outside',  short: 'goes outside' },
  move:    { rule: 'Never ask me to move around', short: 'moves around' },
  talk:    { rule: 'Never ask me to talk out loud', short: 'talks out loud' },
  sound:   { rule: 'Never ask me to make sound',  short: 'makes sound' },
  camera:  { rule: 'Never ask me to use the camera', short: 'uses the camera' },
};

export const ADAPTS = {
  smaller: 'Make it smaller',
  indoors: 'Stay indoors',
  still:   'Without moving around',
  quiet:   'Keep it silent',
  nocam:   'No camera',
  weirder: 'Make it weirder',
};

// Order the engine tries when a card's original form breaks a hard rule.
export const RESCUE_ORDER = ['indoors', 'still', 'quiet', 'nocam', 'smaller'];

export const RATINGS = {
  stuck: [
    { v: -1, label: 'Still stuck' },
    { v: 1,  label: 'A little clearer' },
    { v: 2,  label: 'Ready to move' },
  ],
  bored: [
    { v: -1, label: 'Not for me' },
    { v: 1,  label: 'Enjoyed it' },
    { v: 2,  label: 'Loved it' },
  ],
};

export const SKIP_REASONS = [
  { key: 'none',     label: 'Just not this one' },
  { key: 'possible', label: 'Not possible here' },
  { key: 'effort',   label: 'Too much effort' },
  { key: 'relevant', label: 'Not relevant' },
  { key: 'similar',  label: 'Done something similar' },
];

export const TEMP_CONTEXT_HOURS = 4;
export const MAX_PINS = 7;
