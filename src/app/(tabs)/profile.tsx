import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, SegmentedButtons, Text } from 'react-native-paper';

import { repositories } from '@/db';
import { useProfile, useThemePreference } from '@/db/hooks';
import type { Profile } from '@/db/schema';
import { THEME_PREFERENCES, type ThemePreference } from '@/domain/schemas';
import { ACTIVITY_TITLES, goalRateLabel, SEX_LABELS } from '@/features/profile/labels';
import { WeightDialog } from '@/features/profile/WeightDialog';
import { DataSection } from '@/features/backup/DataSection';
import { formatDecimal, formatInt, formatKcal } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Авто',
  light: 'Светлая',
  dark: 'Тёмная',
};

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { profile } = useProfile();
  const themePreference = useThemePreference();
  const [weightOpen, setWeightOpen] = useState(false);

  if (!profile) return null;

  const save = (next: Profile) => {
    const { id: _id, updatedAt: _updatedAt, ...input } = next;
    repositories.profile.save(input);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card mode="contained" style={{ backgroundColor: theme.colors.primaryContainer }}>
        <Card.Content style={styles.gap}>
          <View style={styles.titleRow}>
            <Text variant="labelLarge" style={{ color: theme.colors.onPrimaryContainer }}>
              Цели на день
            </Text>
            <Chip compact>{profile.targetOverridden ? 'Вручную' : 'Рассчитано'}</Chip>
          </View>
          <Text variant="displaySmall" style={{ color: theme.colors.onPrimaryContainer }}>
            {formatKcal(profile.kcalTarget)}
          </Text>
          <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
            Белок {formatInt(profile.proteinMinG)}–{formatInt(profile.proteinTargetG)} г
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={styles.gap}>
          <Row label="Пол" value={SEX_LABELS[profile.sex]} />
          <Divider />
          <Row label="Возраст" value={`${profile.age} лет`} />
          <Divider />
          <Row label="Рост" value={`${formatDecimal(profile.heightCm)} см`} />
          <Divider />
          <Row label="Вес" value={`${formatDecimal(profile.weightKg)} кг`} />
          <Divider />
          <Row label="Активность" value={ACTIVITY_TITLES[profile.activityLevel]} />
          <Divider />
          <Row label="Темп" value={goalRateLabel(profile.goalRateKgPerWeek)} />
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => setWeightOpen(true)}>Обновить вес</Button>
          <Button mode="contained-tonal" onPress={() => router.push('/edit-profile')}>
            Изменить
          </Button>
        </Card.Actions>
      </Card>

      <View style={styles.gap}>
        <Text variant="titleMedium" accessibilityRole="header">
          Тема
        </Text>
        <SegmentedButtons
          value={themePreference}
          onValueChange={(value) => repositories.settings.setTheme(value as ThemePreference)}
          buttons={THEME_PREFERENCES.map((t) => ({ value: t, label: THEME_LABELS[t] }))}
        />
      </View>

      <DataSection />

      {weightOpen ? (
        <WeightDialog
          visible
          profile={profile}
          onDismiss={() => setWeightOpen(false)}
          onSave={save}
        />
      ) : null}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text variant="bodyLarge">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  gap: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 32,
    alignItems: 'center',
  },
});
