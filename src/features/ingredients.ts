import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { IngredientCategory } from '@/domain/types';

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

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  dairy: 'Молочное',
  meat: 'Мясо',
  grains: 'Крупы',
  vegetables: 'Овощи',
  fruits: 'Фрукты',
  eggs: 'Яйца',
  bread: 'Хлеб',
  canned: 'Консервы',
  oil: 'Масло',
  spices: 'Специи',
};
