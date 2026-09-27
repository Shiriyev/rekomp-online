import type { ActivityLevel, GoalRate, Sex } from './types';

/** Multipliers applied to BMR to get TDEE. */
export const ACTIVITY_FACTORS: Readonly<Record<ActivityLevel, number>> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** kcal in 1 kg of body fat, used to turn a weekly rate into a daily deficit. */
export const KCAL_PER_KG = 7700;

export const PROTEIN_TARGET_G_PER_KG = 2.0;
export const PROTEIN_MIN_G_PER_KG = 1.6;

const KCAL_FLOOR: Readonly<Record<Sex, number>> = { male: 1500, female: 1200 };

export type BodyInput = { sex: Sex; age: number; heightCm: number; weightKg: number };

/** Mifflin–St Jeor basal metabolic rate, kcal/day. */
export function bmr({ sex, age, heightCm, weightKg }: BodyInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function tdee(body: BodyInput, activity: ActivityLevel): number {
  return bmr(body) * ACTIVITY_FACTORS[activity];
}

/** Daily kcal deficit for a weekly rate in kg (negative rate = losing). −0.5 kg/week ≈ 550 kcal. */
export function dailyDeficit(goalRateKgPerWeek: GoalRate): number {
  const deficit = (-goalRateKgPerWeek * KCAL_PER_KG) / 7;
  return deficit === 0 ? 0 : deficit; // avoid -0 for maintenance
}

/** Lowest safe daily target: never below BMR nor the per-sex absolute floor. */
export function kcalFloor(body: BodyInput): number {
  return Math.max(bmr(body), KCAL_FLOOR[body.sex]);
}

export type Targets = {
  bmr: number;
  tdee: number;
  deficit: number;
  kcalTarget: number;
  /** True when the raw target was below the safe floor and got raised to it. */
  clampedToFloor: boolean;
  proteinTargetG: number;
  proteinMinG: number;
};

export function calculateTargets(
  body: BodyInput,
  activity: ActivityLevel,
  goalRateKgPerWeek: GoalRate,
): Targets {
  const b = bmr(body);
  const t = b * ACTIVITY_FACTORS[activity];
  const deficit = dailyDeficit(goalRateKgPerWeek);
  const raw = t - deficit;
  const floor = kcalFloor(body);
  const clampedToFloor = raw < floor;

  return {
    bmr: Math.round(b),
    tdee: Math.round(t),
    deficit: Math.round(deficit),
    kcalTarget: Math.round(clampedToFloor ? floor : raw),
    clampedToFloor,
    proteinTargetG: Math.round(body.weightKg * PROTEIN_TARGET_G_PER_KG),
    proteinMinG: Math.round(body.weightKg * PROTEIN_MIN_G_PER_KG),
  };
}

/** True when a manual target is below the safe floor (allowed, but the UI must warn). */
export function isBelowFloor(kcalTarget: number, body: BodyInput): boolean {
  return kcalTarget < Math.round(kcalFloor(body));
}

export type StoredTargets = {
  kcalTarget: number;
  proteinTargetG: number;
  proteinMinG: number;
  targetOverridden: boolean;
};

export type WeightChangePlan =
  | { kind: 'recalculated'; targets: Targets }
  /** Targets are manual: ask before replacing them; `proposed` is what "Recalculate" would set. */
  | { kind: 'needs_confirmation'; proposed: Targets };

/** What to do with targets when the user updates their weight. */
export function planWeightChange(
  profile: BodyInput &
    StoredTargets & { activityLevel: ActivityLevel; goalRateKgPerWeek: GoalRate },
  newWeightKg: number,
): WeightChangePlan {
  const targets = calculateTargets(
    { ...profile, weightKg: newWeightKg },
    profile.activityLevel,
    profile.goalRateKgPerWeek,
  );
  return profile.targetOverridden
    ? { kind: 'needs_confirmation', proposed: targets }
    : { kind: 'recalculated', targets };
}
