import { calculateTargets } from '../calculator';
import { AGREED_TARGETS, buildProfile } from '../profile';
import { parseDecimal, profileSchema } from '../schemas';

const body = { sex: 'male' as const, age: 30, heightCm: 180, weightKg: 85 };

describe('parseDecimal', () => {
  it.each([
    ['82', 82],
    ['82,5', 82.5],
    [' 82.5 ', 82.5],
  ])('parses %p', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1e3', '82,5,1', '.5'])('rejects %p', (input) => {
    expect(parseDecimal(input)).toBeNaN();
  });
});

describe('buildProfile', () => {
  it('stores calculated targets when no manual values are given', () => {
    const t = calculateTargets(body, 'moderate', -0.5);
    expect(buildProfile(body, 'moderate', -0.5, null)).toEqual({
      ...body,
      activityLevel: 'moderate',
      goalRateKgPerWeek: -0.5,
      kcalTarget: t.kcalTarget,
      proteinTargetG: t.proteinTargetG,
      proteinMinG: t.proteinMinG,
      targetOverridden: false,
    });
  });

  it('stores manual targets and marks them overridden', () => {
    const p = buildProfile(body, 'moderate', -0.5, AGREED_TARGETS);
    expect(p).toMatchObject({ kcalTarget: 2150, proteinTargetG: 140, proteinMinG: 120 });
    expect(p.targetOverridden).toBe(true);
    expect(profileSchema.safeParse(p).success).toBe(true);
  });
});
