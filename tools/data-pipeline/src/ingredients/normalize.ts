/**
 * Ingredient name normalisation: lower case, no preparation words, singular, then the
 * synonym table. "Finely Chopped Red Onions" → "red onion".
 */
export const PREPARATION_WORDS = [
  'chopped',
  'diced',
  'sliced',
  'minced',
  'grated',
  'crushed',
  'peeled',
  'shredded',
  'finely',
  'roughly',
  'thinly',
  'freshly',
  'fresh',
  'large',
  'small',
  'medium',
  'whole',
  'halved',
  'quartered',
  'cubed',
  'trimmed',
  'washed',
  'rinsed',
  'drained',
  'softened',
  'melted',
  'beaten',
  'boiled',
  'cooked',
  'raw',
  'organic',
  'free-range',
  'free range',
  'skinless',
  'boneless',
  'lean',
  'chunks',
  'pieces',
  'to serve',
  'for frying',
  'optional',
];

// Words that look plural but are not (or whose singular means something else).
const KEEP = new Set([
  'asparagus',
  'couscous',
  'hummus',
  'molasses',
  'lemongrass',
  'swiss',
  'brussels',
  'grass',
  'bass',
  'cress',
  'watercress',
  'peas',
  'oats',
  'greens',
  'herbs',
  'noodles',
  'chives',
  'lentils',
  'beans',
  'chickpeas',
  'capers',
  'sprouts',
  'olives',
  'raisins',
  'oregano',
  'harissa',
  'paprika',
  'quinoa',
  'feta',
  'tortillas',
  'flakes',
  'seeds',
  'grits',
  'oats',
]);

export function singular(word: string): string {
  if (KEEP.has(word) || word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ches') || word.endsWith('shes') || word.endsWith('xes'))
    return word.slice(0, -2);
  if (word.endsWith('ves')) return `${word.slice(0, -3)}f`;
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}

export function normalizeName(
  raw: string,
  synonyms: Readonly<Record<string, string>> = {},
): string {
  let s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z\s-]/g, ' ');
  // «Minced beef» is ground meat, not a cut: keep the distinction before stripping «minced».
  s = s.replace(/\bminced\s+(beef|pork|lamb|chicken|turkey|meat|veal)\b/g, 'ground $1');
  for (const w of PREPARATION_WORDS) s = s.replace(new RegExp(`\\b${w}\\b`, 'g'), ' ');
  s = s.replace(/\s+/g, ' ').trim();
  const words = s.split(' ').filter(Boolean);
  // Only the head noun (last word) is singularised: «green beans» → «green bean» is avoided
  // by KEEP; «red onions» → «red onion».
  if (words.length > 0) words[words.length - 1] = singular(words[words.length - 1]!);
  const name = words.join(' ');
  return synonyms[name] ?? name;
}
