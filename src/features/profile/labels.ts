import { ACTIVITY_LEVELS, type ActivityLevel, type GoalRate, type Sex } from '@/domain/types';
import { currentLocale, t } from '@/i18n';

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

/** «−0,25» / «−0.25»: true minus sign, locale decimal separator. */
const rateText = (rate: GoalRate): string => {
  const abs = new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 2 }).format(
    Math.abs(rate),
  );
  return rate < 0 ? `−${abs}` : abs;
};

export const goalOptions = (): GoalOption[] => [
  { value: 0, label: rateText(0), description: t('profile.goal.keep') },
  { value: -0.25, label: rateText(-0.25), description: t('profile.goal.soft') },
  { value: -0.5, label: rateText(-0.5), description: t('profile.goal.recommended') },
  { value: -0.75, label: rateText(-0.75), description: t('profile.goal.fast') },
];

export const goalRateLabel = (rate: GoalRate): string =>
  rate === 0 ? t('profile.goal.keep') : t('profile.goal.rateValue', { rate: rateText(rate) });
