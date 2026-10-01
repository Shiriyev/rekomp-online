import {
  afterTaking,
  elapsedSec,
  endsAt,
  formatTimer,
  isDone,
  isRunning,
  pauseTimer,
  planConsumption,
  proteinStreak,
  remainingSec,
  resetTimer,
  startTimer,
  stepIngredients,
  durationParts,
  recipeOverview,
} from '../cooking';
import type { PantryStock } from '../pantry';
import type { NutritionIngredient, RecipeLine, Unit } from '../types';

const ing = (
  id: string,
  unit: Unit = 'g',
  extra: Partial<NutritionIngredient> = {},
): NutritionIngredient => ({
  id,
  unit,
  gramsPerPiece: unit === 'pcs' ? 55 : null,
  kcalPer100g: 100,
  proteinPer100g: 10,
  isStaple: false,
  ...extra,
});
const INGREDIENTS = new Map(
  [
    ing('chicken'),
    ing('egg', 'pcs'),
    ing('skyr'),
    ing('greek'),
    ing('salt', 'g', { isStaple: true }),
  ].map((i) => [i.id, i]),
);
const line = (
  ingredientId: string,
  amount: number,
  extra: Partial<RecipeLine> = {},
): RecipeLine => ({
  ingredientId,
  amountPerServing: amount,
  unit: INGREDIENTS.get(ingredientId)!.unit,
  optional: false,
  altGroup: null,
  sortOrder: 0,
  ...extra,
});
const pantry = (e: Record<string, number>): PantryStock =>
  new Map(
    Object.entries(e).map(([id, q]) => [id, { quantity: q, unit: INGREDIENTS.get(id)!.unit }]),
  );

describe('planConsumption', () => {
  const LINES = [
    line('chicken', 220),
    line('egg', 1),
    line('skyr', 150, { altGroup: 'y', sortOrder: 1 }),
    line('greek', 150, { altGroup: 'y', sortOrder: 2 }),
    line('salt', 0),
  ];

  it('takes required amounts × servings when there is enough', () => {
    const c = planConsumption(
      LINES,
      INGREDIENTS,
      pantry({ chicken: 1000, egg: 10, skyr: 500 }),
      3,
      {},
    );
    expect(c.take).toEqual([
      { ingredientId: 'chicken', amount: 660, unit: 'g' },
      { ingredientId: 'egg', amount: 3, unit: 'pcs' },
      { ingredientId: 'skyr', amount: 450, unit: 'g' },
    ]);
    expect(c.shortfall).toEqual([]);
  });

  it('never takes more than available and records the shortfall', () => {
    const c = planConsumption(LINES, INGREDIENTS, pantry({ chicken: 500 }), 3, {});
    expect(c.take).toEqual([{ ingredientId: 'chicken', amount: 500, unit: 'g' }]);
    expect(c.shortfall).toEqual([
      { ingredientId: 'chicken', amount: 160, unit: 'g' },
      { ingredientId: 'egg', amount: 3, unit: 'pcs' },
      { ingredientId: 'skyr', amount: 450, unit: 'g' },
    ]);
  });

  it('uses the chosen alternative and skips staples', () => {
    const c = planConsumption(
      LINES,
      INGREDIENTS,
      pantry({ chicken: 220, egg: 1, greek: 150, salt: 100 }),
      1,
      {
        y: 'greek',
      },
    );
    expect(c.take.map((t) => t.ingredientId)).toEqual(['chicken', 'egg', 'greek']);
  });

  it('ignores zero-amount lines and rejects unknown ingredients', () => {
    expect(planConsumption([line('chicken', 0)], INGREDIENTS, pantry({}), 1, {})).toEqual({
      take: [],
      shortfall: [],
    });
    expect(() =>
      planConsumption(
        [{ ...line('chicken', 1), ingredientId: 'x' }],
        INGREDIENTS,
        pantry({}),
        1,
        {},
      ),
    ).toThrow('Unknown ingredient');
  });
});

describe('afterTaking', () => {
  it('clamps at zero and normalises', () => {
    expect(afterTaking(500, 660, 'g')).toBe(0);
    expect(afterTaking(350.4, 100, 'g')).toBe(250);
    expect(afterTaking(7, 2.5, 'pcs')).toBe(4.5);
  });
});

describe('timers', () => {
  const t0 = { durationSec: 540, startedAt: null, elapsedSec: 0 };

  it('counts down only while running and survives pause/resume', () => {
    const started = startTimer(t0, 1_000);
    expect(isRunning(started, 61_000)).toBe(true);
    expect(remainingSec(started, 61_000)).toBe(480);
    expect(endsAt(started)).toBe(541_000);

    const paused = pauseTimer(started, 61_000);
    expect(paused).toEqual({ durationSec: 540, startedAt: null, elapsedSec: 60 });
    expect(remainingSec(paused, 999_999)).toBe(480);
    expect(endsAt(paused)).toBeNull();

    const resumed = startTimer(paused, 100_000);
    expect(remainingSec(resumed, 160_000)).toBe(420);
    expect(endsAt(resumed)).toBe(100_000 + 480_000);
  });

  it('finishes and cannot be started again until reset', () => {
    const started = startTimer(t0, 0);
    expect(isDone(started, 540_000)).toBe(true);
    expect(isRunning(started, 540_000)).toBe(false);
    expect(remainingSec(started, 600_000)).toBe(0);
    const done = pauseTimer(started, 600_000);
    expect(done.elapsedSec).toBe(540);
    expect(startTimer(done, 700_000)).toBe(done);
    expect(resetTimer(done)).toEqual(t0);
  });

  it('is idempotent for start/pause in the wrong state and tolerates clock skew', () => {
    const started = startTimer(t0, 5_000);
    expect(startTimer(started, 9_000)).toBe(started);
    expect(pauseTimer(t0, 9_000)).toBe(t0);
    expect(elapsedSec(started, 1_000)).toBe(0);
  });

  it.each([
    [540, '9:00'],
    [5, '0:05'],
    [4.2, '0:05'],
    [3723, '1:02:03'],
    [0, '0:00'],
  ])('formats %p s as %p', (s, text) => {
    expect(formatTimer(s)).toBe(text);
  });
});

describe('proteinStreak', () => {
  const days = (entries: Record<string, number>) => new Map(Object.entries(entries));

  it('counts consecutive days including today when met', () => {
    expect(
      proteinStreak(
        days({ '2026-09-25': 130, '2026-09-26': 125, '2026-09-27': 121 }),
        120,
        '2026-09-27',
      ),
    ).toBe(3);
  });

  it('does not break on an unfinished today', () => {
    expect(proteinStreak(days({ '2026-09-26': 125, '2026-09-27': 40 }), 120, '2026-09-27')).toBe(1);
  });

  it('stops at a gap and crosses month boundaries', () => {
    expect(
      proteinStreak(
        days({ '2026-08-30': 150, '2026-08-31': 150, '2026-09-01': 150 }),
        120,
        '2026-09-01',
      ),
    ).toBe(3);
    expect(proteinStreak(days({ '2026-09-25': 150, '2026-09-27': 150 }), 120, '2026-09-27')).toBe(
      1,
    );
    expect(proteinStreak(days({}), 120, '2026-09-27')).toBe(0);
  });
});

describe('stepIngredients', () => {
  const LINES = [
    line('chicken', 220),
    line('skyr', 150, { altGroup: 'y', sortOrder: 1 }),
    line('greek', 150, { altGroup: 'y', sortOrder: 2 }),
    line('salt', 0),
  ];

  it('scales amounts, keeps only the chosen alternative and marks staples', () => {
    expect(
      stepIngredients(['chicken', 'skyr', 'greek', 'salt'], LINES, INGREDIENTS, 3, { y: 'greek' }),
    ).toEqual([
      { ingredientId: 'chicken', amount: 660, unit: 'g' },
      { ingredientId: 'greek', amount: 450, unit: 'g' },
      { ingredientId: 'salt', amount: null, unit: 'g' },
    ]);
  });

  it('drops refs that are not recipe lines', () => {
    expect(stepIngredients(['ghost'], LINES, INGREDIENTS, 1, {})).toEqual([]);
  });
});

describe('recipeOverview', () => {
  it('phrases steps as a sequence and adds up timer minutes', () => {
    const o = recipeOverview([
      { order: 2, text: 'Обжарить курицу.', timerSec: 360 },
      { order: 1, text: 'Нарезать курицу.', timerSec: null },
      { order: 3, text: 'Добавить овощи.', timerSec: 180 },
      { order: 4, text: 'Тушить под крышкой.', timerSec: 1200 },
    ]);
    expect(o.entries.map((e) => [e.order, e.position, e.timerSec, e.startsAtMin])).toEqual([
      [1, 'first', null, 0],
      [2, 'middle', 360, 0],
      [3, 'middle', 180, 6],
      [4, 'last', 1200, 9],
    ]);
    expect(o.timedTotalMin).toBe(29);
  });

  it('handles a single step and no steps', () => {
    expect(
      recipeOverview([{ order: 1, text: 'Подать.', timerSec: null }]).entries[0]?.position,
    ).toBe('first');
    expect(recipeOverview([])).toEqual({ entries: [], timedTotalMin: 0 });
  });

  it.each([
    [30, { unit: 'sec', value: 30 }],
    [60, { unit: 'min', value: 1 }],
    [90, { unit: 'min', value: 1.5 }],
    [540, { unit: 'min', value: 9 }],
  ] as const)('durationParts(%p) = %p', (s, parts) => {
    expect(durationParts(s)).toEqual(parts);
  });
});
