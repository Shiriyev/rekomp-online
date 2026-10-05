import type { ActivityLevel, GoalMode, GoalRate, Sex } from './types';

/** Multipliers applied to BMR to get TDEE. */
export const ACTIVITY_FACTORS: Readonly<Record<ActivityLevel, number>> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** kcal in 1 kg of body weight, used to turn a weekly rate into a daily deficit or surplus. */
export const KCAL_PER_KG = 7700;

/** Protein g/kg by mode: higher on a deficit to keep muscle, 1.8 is enough on a surplus. */
export const PROTEIN_G_PER_KG: Readonly<Record<GoalMode, { target: number; min: number }>> = {
  lose: { target: 2.0, min: 1.6 },
  keep: { target: 2.0, min: 1.6 },
  gain: { target: 1.8, min: 1.6 },
};

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

export function goalMode(rate: GoalRate): GoalMode {
  if (rate < 0) return 'lose';
  return rate > 0 ? 'gain' : 'keep';
}

/**
 * Daily kcal change for a weekly rate in kg: negative = deficit, positive = surplus.
 * −0.5 kg/week ≈ −550 kcal, +0.25 ≈ +275.
 */
export function dailyKcalDelta(goalRateKgPerWeek: GoalRate): number {
  return (goalRateKgPerWeek * KCAL_PER_KG) / 7;
}

/** Lowest safe daily target: never below BMR nor the per-sex absolute floor. */
export function kcalFloor(body: BodyInput): number {
  return Math.max(bmr(body), KCAL_FLOOR[body.sex]);
}

export type Targets = {
  bmr: number;
  tdee: number;
  /** kcalTarget − TDEE before the floor: negative = deficit, positive = surplus. */
  kcalDelta: number;
  kcalTarget: number;
  /** True when a deficit target was below the safe floor and got raised to it. */
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
  const delta = dailyKcalDelta(goalRateKgPerWeek);
  const raw = t + delta;
  const floor = kcalFloor(body);
  // The floor guards against too deep a deficit; a surplus is never lowered or raised by it.
  const clampedToFloor = goalRateKgPerWeek <= 0 && raw < floor;
  const protein = PROTEIN_G_PER_KG[goalMode(goalRateKgPerWeek)];

  return {
    bmr: Math.round(b),
    tdee: Math.round(t),
    kcalDelta: Math.round(delta) || 0, // avoid -0 for maintenance
    kcalTarget: Math.round(clampedToFloor ? floor : raw),
    clampedToFloor,
    proteinTargetG: Math.round(body.weightKg * protein.target),
    proteinMinG: Math.round(body.weightKg * protein.min),
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
