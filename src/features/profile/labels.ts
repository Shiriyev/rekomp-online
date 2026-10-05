import { dailyKcalDelta, goalMode } from '@/domain/calculator';
import {
  ACTIVITY_LEVELS,
  GOAL_MODES,
  GOAL_RATES,
  type ActivityLevel,
  type GoalMode,
  type GoalRate,
  type Sex,
} from '@/domain/types';
import { currentLocale, t } from '@/i18n';
import { formatInt } from '@/lib/format';

// Functions, not constants: they read the current language (the tree remounts on a switch).

export const sexLabel = (sex: Sex): string => t(`profile.sex.${sex}`);

export type ActivityOption = {
  value: ActivityLevel;
  title: string;
  description: string;
  hint?: string;
};

export const activityTitle = (level: ActivityLevel): string => t(`profile.activity.${level}.title`);

export const activityOptions = (): ActivityOption[] =>
  ACTIVITY_LEVELS.map((value) => ({
    value,
    title: activityTitle(value),
    description: t(`profile.activity.${value}.description`),
    hint: value === 'moderate' ? t('profile.activity.moderateHint') : undefined,
  }));

export type GoalOption = { value: GoalRate; label: string; description: string };

/** «−0,25» / «+0.25»: true minus sign, explicit plus, locale decimal separator. */
const rateText = (rate: GoalRate): string => {
  const abs = new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 2 }).format(
    Math.abs(rate),
  );
  if (rate < 0) return `−${abs}`;
  return rate > 0 ? `+${abs}` : abs;
};

const RATE_DESCRIPTION_KEYS = {
  [-1]: 'profile.goal.veryFast',
  [-0.75]: 'profile.goal.fast',
  [-0.5]: 'profile.goal.recommended',
  [-0.25]: 'profile.goal.soft',
  0: 'profile.goal.keep',
  0.25: 'profile.goal.leanGain',
  0.5: 'profile.goal.fastGain',
  0.75: 'profile.goal.fastGain',
} as const satisfies Record<GoalRate, string>;

/** The rate a mode starts at when the user switches to it. */
export const MODE_DEFAULT_RATE: Readonly<Record<GoalMode, GoalRate>> = {
  lose: -0.5,
  keep: 0,
  gain: 0.25,
};

export const goalModeOptions = (): { value: GoalMode; label: string }[] =>
  GOAL_MODES.map((value) => ({ value, label: t(`profile.goal.mode.${value}`) }));

/** Rates of one mode, slowest first (−0.25 … −1, +0.25 … +0.75). */
export const goalOptions = (mode: GoalMode): GoalOption[] =>
  GOAL_RATES.filter((r) => goalMode(r) === mode)
    .sort((a, b) => Math.abs(a) - Math.abs(b))
    .map((value) => ({
      value,
      label: rateText(value),
      description: t(RATE_DESCRIPTION_KEYS[value]),
    }));

/** «дефицит 550 ккал» / «профицит 275 ккал» / null for maintenance. */
export const kcalDeltaLabel = (kcalDelta: number): string | null => {
  const kcal = formatInt(Math.abs(kcalDelta));
  if (kcalDelta < 0) return t('profile.goal.deficit', { kcal });
  return kcalDelta > 0 ? t('profile.goal.surplus', { kcal }) : null;
};

/** Profile row: «Похудение: −0,5 кг/нед · дефицит ~550 ккал», «Держать вес». */
export const goalRateLabel = (rate: GoalRate): string => {
  const mode = goalMode(rate);
  if (mode === 'keep') return t('profile.goal.keep');
  return t('profile.goal.rateSummary', {
    mode: t(`profile.goal.mode.${mode}`),
    rate: rateText(rate),
    delta: kcalDeltaLabel(Math.round(dailyKcalDelta(rate))) ?? '',
  });
};
