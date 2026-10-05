/**
 * @jest-environment node
 *
 * FIXES v1.1 task 6: amounts edited on the recipe card drive the cook.
 */
import { recipeMacros, roundKcal, roundProtein } from '../../domain/nutrition';
import { createRepositories, type Repositories } from '../repositories';
import { runSeed } from '../seed/runSeed';
import { createTestDb } from '../testing/createTestDb';
import type { AppDb } from '../types';

let db: AppDb;
let close: () => void;
let repos: Repositories;
const NOW = Date.UTC(2026, 8, 27, 10);

beforeEach(() => {
  ({ db, close } = createTestDb());
  runSeed(db);
  repos = createRepositories(db);
  repos.pantry.setQuantity('tvorog', 500, NOW);
  repos.pantry.setQuantity('banana', 3, NOW);
  repos.pantry.setQuantity('oats', 500, NOW);
  repos.pantry.setQuantity('berries_frozen', 500, NOW);
});
afterEach(() => close());

const z1Macros = (amounts: Record<string, number>) => {
  const detail = repos.recipes.getDetail('Z1')!;
  const lines = detail.lines.map((l) =>
    amounts[l.ingredientId] === undefined
      ? l
      : { ...l, amountPerServing: amounts[l.ingredientId]! },
  );
  const m = recipeMacros(lines, repos.ingredients.mapById()).perServing;
  return { kcal: roundKcal(m.kcal), protein: roundProtein(m.protein) };
};

describe('cooking with edited amounts (DoD: Z1 творог 250 → 200)', () => {
  it('deducts 200 g and logs the recalculated macros', () => {
    const session = repos.cook.start('Z1', 1, {}, NOW, { tvorog: 200 });
    expect(session.amountOverrides.tvorog).toBe(200);
    const result = repos.cook.finish(session.id, { eaten: 1, mealType: 'breakfast' }, NOW);

    expect(repos.pantry.get('tvorog')?.quantity).toBe(300);
    expect(result.perPortion).toEqual(z1Macros({ tvorog: 200 }));
    expect(result.perPortion.kcal).toBeLessThan(z1Macros({}).kcal);
    const log = repos.logs.get(result.logId!)!;
    expect({ kcal: log.kcal, protein: log.protein }).toEqual(z1Macros({ tvorog: 200 }));
    expect(repos.logs.dayTotals(log.localDate).kcal).toBe(log.kcal);
    expect(repos.cook.get(session.id)?.usedAmounts).toContainEqual({
      ingredientId: 'tvorog',
      amount: 200,
      unit: 'g',
    });
  });

  it('skips a removed ingredient (banana 0) in deduction, macros and the snapshot', () => {
    const r = repos.cook.quickEat('Z1', 1, {}, 'breakfast', NOW, { banana: 0 });
    expect(repos.pantry.get('banana')?.quantity).toBe(3);
    expect(r.perPortion).toEqual(z1Macros({ banana: 0 }));
    const used = repos.cook.get(r.sessionId)!.usedAmounts!.map((u) => u.ingredientId);
    expect(used).not.toContain('banana');
  });

  it('scales the per-serving draft by servings for batches', () => {
    repos.pantry.setQuantity('chicken_breast', 2000, NOW);
    const s = repos.cook.start('O1', 3, {}, NOW, { chicken_breast: 200 });
    repos.cook.finish(s.id, { eaten: 0, mealType: 'lunch' }, NOW);
    expect(repos.pantry.get('chicken_breast')?.quantity).toBe(1400);
  });

  it('follows a draft changed while the cook is open; undo returns exactly that', () => {
    const s = repos.cook.start('Z1', 1, {}, NOW, { tvorog: 200 });
    repos.cook.setAmounts(s.id, { tvorog: 150 });
    const r = repos.cook.finish(s.id, { eaten: 1, mealType: 'breakfast' }, NOW);
    expect(repos.pantry.get('tvorog')?.quantity).toBe(350);
    repos.cook.undo(r.sessionId, NOW);
    expect(repos.pantry.get('tvorog')?.quantity).toBe(500);
    // A finished session no longer changes.
    expect(repos.cook.setAmounts(s.id, { tvorog: 1 })?.amountOverrides.tvorog).toBe(150);
  });

  it('takes new servings from the card for an open cook (draft × servings)', () => {
    repos.pantry.setQuantity('tvorog', 1000, NOW);
    const s = repos.cook.start('Z1', 1, {}, NOW);
    const updated = repos.cook.setAmounts(s.id, { tvorog: 200 }, 3);
    expect(updated).toMatchObject({ servings: 3, amountOverrides: { tvorog: 200 } });
    repos.cook.finish(s.id, { eaten: 1, mealType: 'breakfast' }, NOW);
    expect(repos.pantry.get('tvorog')?.quantity).toBe(400); // 200 × 3 taken
    expect(() => repos.cook.setAmounts(s.id, {}, 9)).toThrow(RangeError);
  });

  it('ignores invalid or unknown amounts and keeps the recipe for them', () => {
    const s = repos.cook.start('Z1', 1, {}, NOW, { tvorog: -10, ghost: 5, oats: Number.NaN });
    expect(s.amountOverrides).toMatchObject({ tvorog: 250, oats: 40 });
    expect(s.amountOverrides).not.toHaveProperty('ghost');
  });

  it('without a draft cooks the recipe as before', () => {
    const r = repos.cook.quickEat('Z1', 1, {}, 'breakfast', NOW);
    expect(repos.pantry.get('tvorog')?.quantity).toBe(250);
    expect(r.perPortion).toEqual(z1Macros({}));
  });
});

describe('«моя версия рецепта»', () => {
  it('becomes the default for the next cook and can be reset', () => {
    expect(repos.recipes.saveCustomAmounts('Z1', { tvorog: 200, oats: 40, ghost: 9 })).toBe(1);
    const r = repos.cook.quickEat('Z1', 1, {}, 'breakfast', NOW);
    expect(repos.pantry.get('tvorog')?.quantity).toBe(300);
    expect(r.perPortion).toEqual(z1Macros({ tvorog: 200 }));

    // The original lines are untouched.
    expect(
      repos.recipes.getDetail('Z1')!.lines.find((l) => l.ingredientId === 'tvorog')
        ?.amountPerServing,
    ).toBe(250);

    repos.recipes.resetCustomAmounts('Z1');
    repos.cook.quickEat('Z1', 1, {}, 'breakfast', NOW);
    expect(repos.pantry.get('tvorog')?.quantity).toBe(50);
  });

  it('survives a seed re-sync', () => {
    repos.recipes.saveCustomAmounts('Z1', { tvorog: 200 });
    runSeed(db);
    const s = repos.cook.start('Z1', 1, {}, NOW);
    expect(s.amountOverrides.tvorog).toBe(200);
  });

  it('rejects unknown recipes', () => {
    expect(() => repos.recipes.saveCustomAmounts('ZZ', { tvorog: 1 })).toThrow('Recipe not found');
  });
});
