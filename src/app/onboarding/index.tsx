import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { repositories } from '@/db';
import { AGREED_TARGETS } from '@/domain/profile';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { profileToFormValues } from '@/features/profile/profileFormSchema';
import { spacing, useAppTheme } from '@/theme';

const DEFAULTS = profileToFormValues(undefined, AGREED_TARGETS);

export default function OnboardingScreen() {
  const theme = useAppTheme();

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}>
      <ProfileForm
        defaultValues={DEFAULTS}
        submitLabel="Начать"
        // Saving flips the profile guard in the root layout, which navigates to the tabs.
        onSubmit={(profile) => repositories.profile.save(profile)}
        header={
          <View style={styles.header}>
            <Text variant="headlineMedium" accessibilityRole="header">
              Рекомп
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              Посчитаем дневную норму калорий и белка. Можно рассчитать по формуле или ввести свои
              значения — всё меняется потом в профиле.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: spacing.sm, paddingTop: spacing.lg },
});
