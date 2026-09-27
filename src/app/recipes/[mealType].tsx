import { Stack, useLocalSearchParams } from 'expo-router';

import { MEAL_TYPES, type MealType } from '@/domain/types';
import { MEAL_LABELS } from '@/features/meals';
import { EmptyState } from '@/ui/EmptyState';

// Replaced by the recipe list in phase 4.
export default function RecipesScreen() {
  const { mealType } = useLocalSearchParams<{ mealType: string }>();
  const meal = (MEAL_TYPES as readonly string[]).includes(mealType) ? (mealType as MealType) : null;

  return (
    <>
      <Stack.Screen options={{ title: meal ? MEAL_LABELS[meal] : 'Блюда' }} />
      <EmptyState icon="book-open-page-variant-outline" title="Блюда появятся здесь" />
    </>
  );
}
