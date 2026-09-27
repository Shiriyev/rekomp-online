import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { MealType } from '@/domain/types';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  snack: 'Перекус',
  dinner: 'Ужин',
};

export const MEAL_ICONS: Record<MealType, IconName> = {
  breakfast: 'coffee-outline',
  lunch: 'pot-steam-outline',
  snack: 'food-apple-outline',
  dinner: 'silverware-fork-knife',
};

/** Order of meals through the day (also the 2×2 grid order). */
export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
