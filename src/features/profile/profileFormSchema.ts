import { z } from 'zod';

import { buildProfile } from '@/domain/profile';
import { parseDecimal, PROFILE_LIMITS } from '@/domain/schemas';
import { ACTIVITY_LEVELS, GOAL_RATES, SEXES, type GoalRate } from '@/domain/types';
import type { Profile } from '@/db/schema';

const numberText = (limits: { min: number; max: number }, int = false) => {
  const base = z.number({ error: 'Введите число' });
  return z
    .string()
    .transform(parseDecimal)
    .pipe(
      (int ? base.int('Нужно целое число') : base)
        .min(limits.min, `Не меньше ${limits.min}`)
        .max(limits.max, `Не больше ${limits.max}`),
    );
};

const GOAL_KEYS = GOAL_RATES.map(String) as [string, ...string[]];

const manualSchema = z
  .object({
    kcalTarget: numberText(PROFILE_LIMITS.kcalTarget, true),
    proteinTargetG: numberText(PROFILE_LIMITS.proteinG, true),
    proteinMinG: numberText(PROFILE_LIMITS.proteinG, true),
  })
  .refine((v) => v.proteinMinG <= v.proteinTargetG, {
    path: ['proteinMinG'],
    message: 'Минимум не может быть больше цели',
  });

/** Text-based form values → validated ProfileInput (calculated or manual targets). */
export const profileFormSchema = z
  .object({
    sex: z.enum(SEXES, { error: 'Выберите пол' }),
    age: numberText(PROFILE_LIMITS.age, true),
    heightCm: numberText(PROFILE_LIMITS.heightCm),
    weightKg: numberText(PROFILE_LIMITS.weightKg),
    activityLevel: z.enum(ACTIVITY_LEVELS, { error: 'Выберите активность' }),
    goalRate: z.enum(GOAL_KEYS).transform((v) => Number(v) as GoalRate),
    mode: z.enum(['calculate', 'manual']),
    kcalTarget: z.string(),
    proteinTargetG: z.string(),
    proteinMinG: z.string(),
  })
  .transform((v, ctx) => {
    let manual = null;
    if (v.mode === 'manual') {
      const parsed = manualSchema.safeParse(v);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) =>
          ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path }),
        );
        return z.NEVER;
      }
      manual = parsed.data;
    }
    const body = { sex: v.sex, age: v.age, heightCm: v.heightCm, weightKg: v.weightKg };
    return buildProfile(body, v.activityLevel, v.goalRate, manual);
  });

export type ProfileFormValues = z.input<typeof profileFormSchema>;

const str = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

export function profileToFormValues(
  p: Profile | undefined,
  fallbackManual: { kcalTarget: number; proteinTargetG: number; proteinMinG: number },
): ProfileFormValues {
  const manual = p?.targetOverridden ? p : fallbackManual;
  return {
    // Sex/activity start unselected for a new user; zod reports them as required.
    sex: (p?.sex ?? '') as ProfileFormValues['sex'],
    age: str(p?.age),
    heightCm: str(p?.heightCm),
    weightKg: str(p?.weightKg),
    activityLevel: (p?.activityLevel ?? '') as ProfileFormValues['activityLevel'],
    goalRate: String(p?.goalRateKgPerWeek ?? -0.5),
    mode: p?.targetOverridden ? 'manual' : 'calculate',
    kcalTarget: str(manual.kcalTarget),
    proteinTargetG: str(manual.proteinTargetG),
    proteinMinG: str(manual.proteinMinG),
  };
}
