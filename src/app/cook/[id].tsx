import { Stack } from 'expo-router';

import { EmptyState } from '@/ui/EmptyState';

// Replaced by the step-by-step cooking mode in phase 5.
export default function CookScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Готовка' }} />
      <EmptyState icon="chef-hat" title="Режим готовки появится здесь" />
    </>
  );
}
