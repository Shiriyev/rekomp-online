/**
 * English for the built-in (seeded) content. Keyed by seed ids so the database keeps the
 * Russian original; user-created products and manual entries are never translated.
 * Filled for every recipe in src/db/seed/recipes.ts and ingredient in src/db/seed/ingredients.ts.
 */
export type RecipeContent = {
  name: string;
  /** One per seed step, in order. */
  steps: string[];
  /** Line notes («1 ч.л.») by ingredient id. */
  notes?: Record<string, string>;
};

const TSP = '1 tsp';
const TO_TASTE = 'to taste';
const ONE_CAN = '1 can';

export const RECIPES_EN: Record<string, RecipeContent> = {
  // ---------- Breakfast ----------
  Z1: {
    name: 'Cottage cheese with berries and oats',
    steps: [
      'In the evening: put the cottage cheese in a container, top with the berries, cover and refrigerate.',
      'In the morning: add the oats and stir.',
      'Slice the banana on top.',
    ],
  },
  Z2: {
    name: 'Oatmeal with skyr and eggs',
    steps: [
      'Lower the eggs into boiling water.',
      'Pour ~120 ml of boiling water over the oats and cover.',
      'Transfer the eggs to cold water and peel.',
      'Add the skyr and berries to the oatmeal.',
    ],
  },
  Z3: {
    name: 'Eggs with cottage cheese and bread',
    steps: [
      'Heat a non-stick pan.',
      'Crack in the eggs and fry with the lid on.',
      'Slice the vegetables.',
      'Serve with the cottage cheese and bread.',
    ],
  },
  Z4: {
    name: 'Yogurt with cottage cheese and muesli',
    steps: [
      'Put the yogurt and cottage cheese in a bowl and stir.',
      'Sprinkle the muesli on top.',
      'Slice the banana.',
    ],
    notes: { yogurt_01: '2 glasses' },
  },

  // ---------- Lunch (batch) ----------
  O1: {
    name: 'Chicken with rice and vegetables (plov-style)',
    steps: [
      'Cut the chicken into 2–3 cm cubes.',
      'Add oil to a pot and brown the chicken.',
      'Add the vegetables.',
      'Add the rinsed rice, water (2× the volume of rice) and spices.',
      'Bring to a boil, cover and turn the heat to minimum.',
      'Let it rest, stir and divide into containers.',
    ],
    notes: { oil: TSP, cumin: TO_TASTE, salt: TO_TASTE, pepper: TO_TASTE },
  },
  O2: {
    name: 'Lentils with chicken and tomatoes',
    steps: [
      'Rinse the lentils.',
      'Chop the onion and chicken.',
      'Heat the oil and fry the onion and chicken.',
      'Add the lentils, tomatoes and water (2–3 cm above the lentils), and salt.',
      'Simmer covered, stirring occasionally. Check for tenderness; cook 5 min more if needed.',
      'Divide into containers; add the bread when serving.',
    ],
    notes: { oil: TSP, bread_wholegrain: 'when serving', salt: TO_TASTE },
  },
  O3: {
    name: 'Penne with turkey mince',
    steps: [
      'Put on water for the penne.',
      'Heat the oil and brown the mince, breaking up the lumps.',
      'Add the passata and vegetables and simmer.',
      'Meanwhile, cook the penne according to the package.',
      'Drain the penne, mix with the sauce in the pot and divide into portions.',
    ],
    notes: { oil: TSP },
  },
  O4: {
    name: 'Hungarian-style chicken with potatoes',
    steps: [
      'Cut the onion, bell pepper, chicken and potatoes into 2 cm cubes.',
      'Heat the oil and fry the onion and bell pepper.',
      'Add the chicken.',
      'Add the potatoes, tomatoes, ~100 ml of water and spices.',
      'Simmer covered; check the potatoes with a fork.',
    ],
    notes: { oil: TSP, paprika_powder: TO_TASTE, salt: TO_TASTE },
  },

  // ---------- Snack ----------
  P1: {
    name: 'Skyr + apple',
    steps: ['Serve the skyr with the apple.'],
  },
  P2: {
    name: 'Cottage cheese with berries',
    steps: ['In the evening: put the berries on the cottage cheese and refrigerate.', 'Enjoy.'],
  },
  P3: {
    name: 'Eggs and vegetables',
    steps: ['Boil the eggs (or use ones boiled in advance).', 'Slice the vegetables.'],
  },
  P4: {
    name: 'Yogurt + banana',
    steps: ['Serve the yogurt with the banana.'],
  },

  // ---------- Dinner ----------
  U1: {
    name: 'Omelette with vegetables and cheese',
    steps: [
      'Whisk the eggs with salt.',
      'Heat the oil and put the vegetables in the pan.',
      'Pour in the eggs, top with cheese, cover and cook over medium heat.',
      'Serve with bread.',
    ],
    notes: { oil: TSP, salt: TO_TASTE },
  },
  U2: {
    name: 'Penne with tuna',
    steps: [
      'Cook the penne.',
      'Heat the oil and warm the tomatoes or vegetables.',
      'Drain the tuna.',
      'Mix everything together.',
    ],
    notes: { tuna_water: ONE_CAN, oil: TSP },
  },
  U3: {
    name: 'Tuna and egg salad',
    steps: [
      'Boil the eggs (or use ready-made ones).',
      'Chop the vegetables and eggs.',
      'Mix with the tuna and serve with bread.',
    ],
    notes: { tuna_water: ONE_CAN },
  },
  U4: {
    name: 'Shakshuka',
    steps: [
      'Chop the onion and bell pepper.',
      'Heat the oil and fry the onion and bell pepper.',
      'Add the tomatoes.',
      'Make 3 wells and crack in the eggs.',
      'Cover with a lid.',
      'Serve with bread.',
    ],
    notes: { oil: TSP },
  },
};

export const INGREDIENTS_EN: Record<string, string> = {
  tvorog: 'Cottage cheese',
  skyr: 'Skyr',
  greek_yogurt: 'Greek yogurt',
  yogurt_01: 'Yogurt 0.1%',
  egg: 'Egg',
  oats: 'Oats',
  muesli: 'Muesli',
  berries_frozen: 'Frozen berries',
  banana: 'Banana',
  apple: 'Apple',
  bread_wholegrain: 'Wholegrain bread',
  cucumber: 'Cucumber',
  tomato: 'Tomato',
  chicken_breast: 'Chicken breast (raw)',
  turkey_mince: 'Turkey mince',
  rice: 'Rice (dry)',
  penne: 'Penne (dry)',
  lentils_green: 'Green lentils (dry)',
  potato: 'Potatoes',
  veg_frozen: 'Frozen vegetables',
  passata: 'Passata',
  tomatoes_canned: 'Canned tomatoes',
  onion: 'Onion',
  bell_pepper: 'Bell pepper',
  cheese: 'Cheese',
  tuna_water: 'Tuna in brine (drained)',
  oil: 'Vegetable oil',
  cumin: 'Cumin',
  salt: 'Salt',
  pepper: 'Black pepper',
  paprika_powder: 'Ground paprika',
};

/** Recipe tags («с вечера»). */
export const TAGS_EN: Record<string, string> = {
  'с вечера': 'Night before',
  'без готовки': 'No cooking',
  'на 3 дня': 'For 3 days',
};
