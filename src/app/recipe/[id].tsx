import { Stack } from 'expo-router';

import { EmptyState } from '@/ui/EmptyState';

// Replaced by the recipe card in phase 4.
export default function RecipeScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Блюдо' }} />
      <EmptyState icon="chef-hat" title="Карточка блюда появится здесь" />
    </>
  );
}
