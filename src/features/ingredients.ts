import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { INGREDIENT_CATEGORIES, type IngredientCategory } from '@/domain/types';
import { t, useT } from '@/i18n';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const CATEGORY_ICONS: Record<IngredientCategory, IconName> = {
  dairy: 'cup-outline',
  meat: 'food-drumstick-outline',
  grains: 'barley',
  vegetables: 'carrot',
  fruits: 'fruit-cherries',
  eggs: 'egg-outline',
  bread: 'bread-slice-outline',
  canned: 'food-variant',
  oil: 'bottle-tonic-outline',
  spices: 'shaker-outline',
};

/** Category names in the current UI language. */
export const categoryLabel = (category: IngredientCategory): string =>
  t(`common.categories.${category}`);

export const CATEGORY_LABELS: Readonly<Record<IngredientCategory, string>> =
  Object.defineProperties(
    {} as Record<IngredientCategory, string>,
    Object.fromEntries(
      INGREDIENT_CATEGORIES.map((c) => [c, { get: () => categoryLabel(c), enumerable: true }]),
    ),
  );

/** Same as `categoryLabel`, re-rendering the caller on a language change. */
export function useCategoryLabel(): (category: IngredientCategory) => string {
  useT();
  return categoryLabel;
}
