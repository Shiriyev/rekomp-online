import { calculateTargets, type BodyInput } from './calculator';
import type { ProfileInput } from './schemas';
import type { ActivityLevel, GoalRate } from './types';

export type ManualTargets = { kcalTarget: number; proteinTargetG: number; proteinMinG: number };

/** The targets the user agreed on in the original plan; prefilled for "enter my own values". */
export const AGREED_TARGETS: ManualTargets = {
  kcalTarget: 2150,
  proteinTargetG: 140,
  proteinMinG: 120,
};

/** Builds the stored profile: calculated targets, or the user's manual override. */
export function buildProfile(
  body: BodyInput,
  activityLevel: ActivityLevel,
  goalRateKgPerWeek: GoalRate,
  manual: ManualTargets | null,
): ProfileInput {
  const base = { ...body, activityLevel, goalRateKgPerWeek };
  if (manual) return { ...base, ...manual, targetOverridden: true };

  const t = calculateTargets(body, activityLevel, goalRateKgPerWeek);
  return {
    ...base,
    kcalTarget: t.kcalTarget,
    proteinTargetG: t.proteinTargetG,
    proteinMinG: t.proteinMinG,
    targetOverridden: false,
  };
}
