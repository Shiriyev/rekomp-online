import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { repositories } from '@/db';
import { AGREED_TARGETS } from '@/domain/profile';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { profileToFormValues } from '@/features/profile/profileFormSchema';
import { useT } from '@/i18n';
import { spacing, useAppTheme } from '@/theme';

const DEFAULTS = profileToFormValues(undefined, AGREED_TARGETS);

export default function OnboardingScreen() {
  const t = useT();
  const theme = useAppTheme();

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}>
      <ProfileForm
        defaultValues={DEFAULTS}
        submitLabel={t('onboarding.start')}
        // Saving flips the profile guard in the root layout, which navigates to the tabs.
        onSubmit={(profile) => repositories.profile.save(profile)}
        header={
          <View style={styles.header}>
            <Text variant="headlineMedium" accessibilityRole="header">
              {t('onboarding.title')}
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('onboarding.intro')}
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
