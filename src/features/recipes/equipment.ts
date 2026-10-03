import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { Equipment } from '@/db/catalog/schema';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Icon per piece of kitchen equipment a recipe needs (badges on recipe cards). */
export const EQUIPMENT_ICONS: Record<Equipment, IconName> = {
  stove: 'stove',
  oven: 'toaster-oven',
  grill: 'grill-outline',
  microwave: 'microwave',
  multicooker: 'pot-steam-outline',
  blender: 'blender-outline',
  mixer: 'bowl-mix-outline',
};

/** Badge for recipes made without any heat source. */
export const NO_COOK_ICON: IconName = 'leaf';

export const isEquipment = (v: string): v is Equipment => v in EQUIPMENT_ICONS;
