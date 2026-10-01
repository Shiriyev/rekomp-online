import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { MealType } from '@/domain/types';
import { t } from '@/i18n';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Meal names in the current UI language (getters: the tree remounts on a language switch). */
export const MEAL_LABELS: Readonly<Record<MealType, string>> = {
  get breakfast() {
    return t('common.meals.breakfast');
  },
  get lunch() {
    return t('common.meals.lunch');
  },
  get snack() {
    return t('common.meals.snack');
  },
  get dinner() {
    return t('common.meals.dinner');
  },
};

export const MEAL_ICONS: Record<MealType, IconName> = {
  breakfast: 'coffee-outline',
  lunch: 'pot-steam-outline',
  snack: 'food-apple-outline',
  dinner: 'silverware-fork-knife',
};

/** Order of meals through the day (also the 2×2 grid order). */
export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
