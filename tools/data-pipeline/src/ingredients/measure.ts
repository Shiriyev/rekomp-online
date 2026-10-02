/**
 * A TheMealDB measure («1 1/2 cups», «2 x 400g cans», «Pinch») → quantity and unit, using
 * parse-ingredient for the number/unit grammar.
 */
import { parseIngredient } from 'parse-ingredient';

/** Units we convert to grams; `piece` covers «1 onion», «2 large eggs». */
export type MeasureUnit =
  | 'g'
  | 'ml'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'clove'
  | 'can'
  | 'slice'
  | 'handful'
  | 'bunch'
  | 'sprig'
  | 'stick'
  | 'knob'
  | 'piece';

export type Measure =
  | {
      kind: 'amount';
      quantity: number;
      unit: MeasureUnit;
      size: 'small' | 'medium' | 'large' | null;
    }
  /** «to taste», «pinch», «garnish», «dash», empty: staples, outside nutrition and stock. */
  | { kind: 'unquantified' };

const UNIT_MAP: Record<string, { unit: MeasureUnit; factor: number }> = {
  gram: { unit: 'g', factor: 1 },
  kilogram: { unit: 'g', factor: 1000 },
  milligram: { unit: 'g', factor: 0.001 },
  ounce: { unit: 'g', factor: 28.35 },
  pound: { unit: 'g', factor: 453.6 },
  milliliter: { unit: 'ml', factor: 1 },
  liter: { unit: 'ml', factor: 1000 },
  centiliter: { unit: 'ml', factor: 10 },
  deciliter: { unit: 'ml', factor: 100 },
  'fluid ounce': { unit: 'ml', factor: 29.57 },
  pint: { unit: 'ml', factor: 568 },
  quart: { unit: 'ml', factor: 946 },
  cup: { unit: 'cup', factor: 1 },
  tablespoon: { unit: 'tbsp', factor: 1 },
  teaspoon: { unit: 'tsp', factor: 1 },
  clove: { unit: 'clove', factor: 1 },
  can: { unit: 'can', factor: 1 },
  tin: { unit: 'can', factor: 1 },
  jar: { unit: 'can', factor: 1 },
  slice: { unit: 'slice', factor: 1 },
  handful: { unit: 'handful', factor: 1 },
  bunch: { unit: 'bunch', factor: 1 },
  sprig: { unit: 'sprig', factor: 1 },
  stick: { unit: 'stick', factor: 1 },
  knob: { unit: 'knob', factor: 1 },
  piece: { unit: 'piece', factor: 1 },
  fillet: { unit: 'piece', factor: 1 },
  breast: { unit: 'piece', factor: 1 },
  leaf: { unit: 'piece', factor: 1 },
};

const SIZES = new Set(['small', 'medium', 'large']);
const UNQUANTIFIED =
  /\b(to taste|pinch|dash|garnish|sprinkl|drizzle|splash|as needed|to serve|for frying|for greasing|some|few|drops?)\b/i;

/** British/abbreviated spellings parse-ingredient does not know, mapped to its words. */
const ALIASES: [RegExp, string][] = [
  [/\b(tbs|tbsps?|tblsps?|tbls|tbl|tbsp)\b\.?/g, 'tablespoon'],
  [/\b(tsps?|tspn)\b\.?/g, 'teaspoon'],
  [/\blitres?\b/g, 'liter'],
  [/\bmillilitres?\b/g, 'milliliter'],
  [/\bknobs?\b/g, 'knob'],
];

export function parseMeasure(measure: string): Measure {
  let text = measure.trim().toLowerCase();
  // «125g/4½oz», «350ml/12fl»: keep the metric half.
  text = text.replace(/^(\s*[\d.,/ ]+\s*(?:g|kg|ml|l))\s*\/.*$/, '$1');
  for (const [re, word] of ALIASES) text = text.replace(re, word);
  text = text.replace(/(\d)\s*(g|kg|ml|l)\b/g, '$1 $2');
  if (!text || UNQUANTIFIED.test(text)) return { kind: 'unquantified' };

  // «2 x 400g cans» → 800 g
  const times = /^(\d+(?:[.,]\d+)?)\s*x\s*(.+)$/.exec(text);
  if (times) {
    const inner = parseMeasure(times[2]!);
    return inner.kind === 'amount'
      ? { ...inner, quantity: inner.quantity * Number(times[1]!.replace(',', '.')) }
      : inner;
  }

  const parsed = parseIngredient(`${text} x`)[0];
  if (!parsed || parsed.quantity === null || !(parsed.quantity > 0))
    return { kind: 'unquantified' };
  const id = (parsed.unitOfMeasureID ?? '').toLowerCase();
  // «400 g tin» — weight first, the container word is decoration.
  if (SIZES.has(id) || id === '') {
    const rest = parsed.description.toLowerCase();
    const size = SIZES.has(id) ? (id as 'small' | 'medium' | 'large') : null;
    const containerUnit = UNIT_MAP[rest.split(' ')[0] ?? ''];
    if (containerUnit && size === null)
      return { kind: 'amount', quantity: parsed.quantity, unit: containerUnit.unit, size: null };
    return { kind: 'amount', quantity: parsed.quantity, unit: 'piece', size };
  }
  const mapped = UNIT_MAP[id];
  if (!mapped) return { kind: 'amount', quantity: parsed.quantity, unit: 'piece', size: null };
  return {
    kind: 'amount',
    quantity: parsed.quantity * mapped.factor,
    unit: mapped.unit,
    size: null,
  };
}
