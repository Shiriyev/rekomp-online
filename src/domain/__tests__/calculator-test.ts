import {
  ACTIVITY_FACTORS,
  bmr,
  calculateTargets,
  dailyDeficit,
  isBelowFloor,
  kcalFloor,
  planWeightChange,
  tdee,
} from '../calculator';

const man = { sex: 'male' as const, age: 30, heightCm: 180, weightKg: 85 };
const woman = { sex: 'female' as const, age: 30, heightCm: 165, weightKg: 60 };

describe('bmr (Mifflin–St Jeor)', () => {
  it('uses +5 for men', () => {
    // 10·85 + 6.25·180 − 5·30 + 5
    expect(bmr(man)).toBe(1830);
  });

  it('uses −161 for women', () => {
    // 10·60 + 6.25·165 − 5·30 − 161
    expect(bmr(woman)).toBe(1320.25);
  });
});

describe('tdee', () => {
  it.each(Object.entries(ACTIVITY_FACTORS))('%s multiplies BMR by %d', (level, factor) => {
    expect(tdee(man, level as keyof typeof ACTIVITY_FACTORS)).toBeCloseTo(1830 * factor, 6);
  });

  it('has the documented factors', () => {
    expect(Object.values(ACTIVITY_FACTORS)).toEqual([1.2, 1.375, 1.55, 1.725, 1.9]);
  });
});

describe('dailyDeficit', () => {
  it('is 550 kcal/day for −0.5 kg/week', () => {
    expect(dailyDeficit(-0.5)).toBe(550);
  });

  it('scales with the rate and is zero for maintenance', () => {
    expect(dailyDeficit(-0.25)).toBe(275);
    expect(dailyDeficit(-0.75)).toBe(825);
    expect(dailyDeficit(0)).toBe(0);
  });
});

describe('calculateTargets', () => {
  it('subtracts the deficit from TDEE and derives protein from weight', () => {
    expect(calculateTargets(man, 'moderate', -0.5)).toEqual({
      bmr: 1830,
      tdee: 2837, // 2836.5
      deficit: 550,
      kcalTarget: 2287, // 2286.5
      clampedToFloor: false,
      proteinTargetG: 170, // 2.0 g/kg
      proteinMinG: 136, // 1.6 g/kg
    });
  });

  it('keeps maintenance at TDEE', () => {
    expect(calculateTargets(woman, 'light', 0).kcalTarget).toBe(Math.round(1320.25 * 1.375));
  });

  it('clamps women to 1200 kcal when BMR is lower', () => {
    const small = { sex: 'female' as const, age: 50, heightCm: 150, weightKg: 45 };
    const t = calculateTargets(small, 'sedentary', -0.75);
    expect(t).toMatchObject({ kcalTarget: 1200, clampedToFloor: true });
  });

  it('clamps men to 1500 kcal when BMR is lower', () => {
    const older = { sex: 'male' as const, age: 70, heightCm: 160, weightKg: 55 };
    expect(calculateTargets(older, 'sedentary', -0.75)).toMatchObject({
      kcalTarget: 1500,
      clampedToFloor: true,
    });
  });

  it('clamps to BMR when BMR is above the absolute floor', () => {
    const big = { sex: 'male' as const, age: 25, heightCm: 190, weightKg: 110 };
    // BMR 2167.5; TDEE 2601 − 825 = 1776 < BMR
    expect(calculateTargets(big, 'sedentary', -0.75)).toMatchObject({
      kcalTarget: 2168,
      clampedToFloor: true,
    });
  });
});

describe('kcalFloor / isBelowFloor', () => {
  it('is max(BMR, sex floor)', () => {
    expect(kcalFloor(man)).toBe(1830);
    expect(kcalFloor({ ...woman, weightKg: 40, age: 60 })).toBe(1200);
  });

  it('flags manual targets under the floor', () => {
    expect(isBelowFloor(1800, man)).toBe(true);
    expect(isBelowFloor(1830, man)).toBe(false);
    expect(isBelowFloor(2150, man)).toBe(false);
  });
});

describe('planWeightChange', () => {
  const stored = {
    ...man,
    activityLevel: 'moderate' as const,
    goalRateKgPerWeek: -0.5 as const,
    kcalTarget: 2287,
    proteinTargetG: 170,
    proteinMinG: 136,
  };

  it('recalculates silently when targets were calculated', () => {
    const plan = planWeightChange({ ...stored, targetOverridden: false }, 80);
    expect(plan.kind).toBe('recalculated');
    expect(plan.kind === 'recalculated' && plan.targets.proteinTargetG).toBe(160);
  });

  it('asks for confirmation when targets were set manually', () => {
    const plan = planWeightChange({ ...stored, targetOverridden: true }, 80);
    expect(plan).toEqual({
      kind: 'needs_confirmation',
      proposed: calculateTargets({ ...man, weightKg: 80 }, 'moderate', -0.5),
    });
  });
});
