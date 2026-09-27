/**
 * @jest-environment node
 *
 * PLAN phase 1 DoD: kcal/protein computed from ingredients must be within ±15%
 * of the original spreadsheet (docs/menu_recomp.xlsx). The spreadsheet is only a
 * reference; ingredient-based calculation is the source of truth.
 */
import { recipeMacros } from '../../domain/nutrition';
import { createRepositories } from '../repositories';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';

const SPREADSHEET: Record<string, { kcal: number; protein: number }> = {
  Z1: { kcal: 620, protein: 49 },
  Z2: { kcal: 500, protein: 37 },
  Z3: { kcal: 520, protein: 43 },
  Z4: { kcal: 585, protein: 46 },
  O1: { kcal: 680, protein: 61 },
  O2: { kcal: 625, protein: 59 },
  O3: { kcal: 735, protein: 51 },
  O4: { kcal: 560, protein: 60 },
  P1: { kcal: 175, protein: 16 },
  P2: { kcal: 215, protein: 26 },
  P3: { kcal: 160, protein: 13 },
  P4: { kcal: 170, protein: 9 },
  U1: { kcal: 530, protein: 33 },
  U2: { kcal: 465, protein: 39 },
  U3: { kcal: 470, protein: 48 },
  U4: { kcal: 470, protein: 27 },
};

const TOLERANCE = 0.15;

/**
 * Deviations above tolerance, reported instead of silently adjusted (PLAN phase 1).
 * Each entry is asserted to still exceed tolerance so it is removed once resolved.
 */
const KNOWN_DEVIATIONS: Partial<Record<string, 'kcal' | 'protein'>> = {};

const { db, close } = createTestDb();
runSeed(db);
const repos = createRepositories(db);
const ingredientMap = repos.ingredients.mapById();
const computed = repos.recipes
  .listDetails()
  .map((d) => ({ id: d.recipe.id, ...recipeMacros(d.lines, ingredientMap).perServing }));

afterAll(() => close());

const deviation = (actual: number, expected: number) => (actual - expected) / expected;

describe('recipe nutrition vs spreadsheet', () => {
  it('covers exactly the 16 spreadsheet recipes', () => {
    expect(computed.map((c) => c.id).sort()).toEqual(Object.keys(SPREADSHEET).sort());
  });

  it.each(computed.map((c) => [c.id, c] as const))('%s is within ±15%%', (id, c) => {
    const ref = SPREADSHEET[id]!;
    const kcalDev = deviation(c.kcal, ref.kcal);
    const proteinDev = deviation(c.protein, ref.protein);
    const known = KNOWN_DEVIATIONS[id];

    if (known !== 'kcal') expect(Math.abs(kcalDev)).toBeLessThanOrEqual(TOLERANCE);
    if (known !== 'protein') expect(Math.abs(proteinDev)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('known deviations are still present (remove them once resolved)', () => {
    for (const [id, field] of Object.entries(KNOWN_DEVIATIONS)) {
      const c = computed.find((x) => x.id === id)!;
      const ref = SPREADSHEET[id]!;
      const dev =
        field === 'kcal' ? deviation(c.kcal, ref.kcal) : deviation(c.protein, ref.protein);
      expect(Math.abs(dev)).toBeGreaterThan(TOLERANCE);
    }
  });

  it('prints the comparison table for the phase report', () => {
    const table = computed.map((c) => {
      const ref = SPREADSHEET[c.id]!;
      const pct = (d: number) => `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%`;
      return {
        id: c.id,
        kcal: `${Math.round(c.kcal)} / ${ref.kcal} (${pct(deviation(c.kcal, ref.kcal))})`,
        protein: `${c.protein.toFixed(1)} / ${ref.protein} (${pct(deviation(c.protein, ref.protein))})`,
      };
    });
    if (process.env.PRINT_NUTRITION) console.table(table);
    expect(table).toHaveLength(16);
  });
});
