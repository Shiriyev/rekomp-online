import type { ActivityLevel, GoalRate, Sex } from '@/domain/types';

export const SEX_LABELS: Record<Sex, string> = { male: 'Мужской', female: 'Женский' };

export const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  title: string;
  description: string;
  hint?: string;
}[] = [
  { value: 'sedentary', title: 'Минимальная', description: 'Сидячая работа, почти без спорта' },
  { value: 'light', title: 'Лёгкая', description: '1–3 тренировки в неделю' },
  {
    value: 'moderate',
    title: 'Средняя',
    description: 'Много движения днём + 3–5 тренировок',
    hint: 'Курьер на e-bike + зал 3×/нед — выбирай это',
  },
  { value: 'active', title: 'Высокая', description: 'Физический труд или ежедневные тренировки' },
  { value: 'very_active', title: 'Очень высокая', description: 'Спорт 2 раза в день' },
];

export const ACTIVITY_TITLES = Object.fromEntries(
  ACTIVITY_OPTIONS.map((o) => [o.value, o.title]),
) as Record<ActivityLevel, string>;

export const GOAL_OPTIONS: { value: GoalRate; label: string; description: string }[] = [
  { value: 0, label: '0', description: 'Держать вес' },
  { value: -0.25, label: '−0,25', description: 'Мягко' },
  { value: -0.5, label: '−0,5', description: 'Рекомендуется' },
  { value: -0.75, label: '−0,75', description: 'Быстро' },
];

export const goalRateLabel = (rate: GoalRate): string =>
  rate === 0 ? 'Держать вес' : `${GOAL_OPTIONS.find((o) => o.value === rate)?.label} кг/нед`;
