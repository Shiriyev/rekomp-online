import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, SegmentedButtons, Text } from 'react-native-paper';

import { repositories } from '@/db';
import { useLanguagePreference, useProfile, useThemePreference } from '@/db/hooks';
import type { Profile } from '@/db/schema';
import { LANGUAGE_PREFERENCES, type LanguagePreference } from '@/domain/language';
import { THEME_PREFERENCES, type ThemePreference } from '@/domain/schemas';
import { DayStartDialog, dayStartLabel } from '@/features/profile/DayStartDialog';
import { activityTitle, goalRateLabel, sexLabel } from '@/features/profile/labels';
import { WeightDialog } from '@/features/profile/WeightDialog';
import { DataSection } from '@/features/backup/DataSection';
import { showUndo } from '@/features/undo/undoStore';
import { t as translate, useT } from '@/i18n';
import { formatDecimal, formatInt, formatKcal } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

// Language names are always shown in their own language, so they are not translated.
const LANGUAGE_NAMES: Record<Exclude<LanguagePreference, 'system'>, string> = {
  ru: 'Русский',
  en: 'English',
};

const languageLabel = (pref: LanguagePreference): string =>
  pref === 'system' ? translate('profile.language.auto') : LANGUAGE_NAMES[pref];

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { profile } = useProfile();
  const t = useT();
  const themePreference = useThemePreference();
  const languagePreference = useLanguagePreference();
  const [weightOpen, setWeightOpen] = useState(false);
  const [dayStartOpen, setDayStartOpen] = useState(false);

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
              {t('profile.targetsTitle')}
            </Text>
            <Chip compact>
              {profile.targetOverridden
                ? t('profile.targetsManual')
                : t('profile.targetsCalculated')}
            </Chip>
          </View>
          <Text variant="displaySmall" style={{ color: theme.colors.onPrimaryContainer }}>
            {formatKcal(profile.kcalTarget)}
          </Text>
          <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
            {t('profile.proteinRange', {
              min: formatInt(profile.proteinMinG),
              target: formatInt(profile.proteinTargetG),
            })}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={styles.gap}>
          <Row label={t('profile.rows.sex')} value={sexLabel(profile.sex)} />
          <Divider />
          <Row
            label={t('profile.rows.age')}
            value={t('profile.ageValue', { count: profile.age })}
          />
          <Divider />
          <Row
            label={t('profile.rows.height')}
            value={t('profile.heightValue', { value: formatDecimal(profile.heightCm) })}
          />
          <Divider />
          <Row
            label={t('profile.rows.weight')}
            value={t('profile.weightValue', { value: formatDecimal(profile.weightKg) })}
          />
          <Divider />
          <Row label={t('profile.rows.activity')} value={activityTitle(profile.activityLevel)} />
          <Divider />
          <Row label={t('profile.rows.rate')} value={goalRateLabel(profile.goalRateKgPerWeek)} />
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => setWeightOpen(true)}>{t('profile.updateWeight')}</Button>
          <Button mode="contained-tonal" onPress={() => router.push('/edit-profile')}>
            {t('common.actions.edit')}
          </Button>
        </Card.Actions>
      </Card>

      <Card mode="outlined">
        <Card.Content style={styles.gap}>
          <Row label={t('profile.rows.dayStart')} value={dayStartLabel(profile.dayStartHour)} />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('profile.dayStartHint')}
          </Text>
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => setDayStartOpen(true)}>{t('common.actions.edit')}</Button>
        </Card.Actions>
      </Card>

      <View style={styles.gap}>
        <Text variant="titleMedium" accessibilityRole="header">
          {t('profile.theme.title')}
        </Text>
        <SegmentedButtons
          value={themePreference}
          onValueChange={(value) => repositories.settings.setTheme(value as ThemePreference)}
          buttons={THEME_PREFERENCES.map((p) => ({ value: p, label: t(`profile.theme.${p}`) }))}
        />
      </View>

      <View style={styles.gap}>
        <Text variant="titleMedium" accessibilityRole="header">
          {t('profile.language.title')}
        </Text>
        <SegmentedButtons
          value={languagePreference}
          onValueChange={(value) => repositories.settings.setLanguage(value as LanguagePreference)}
          buttons={LANGUAGE_PREFERENCES.map((p) => ({ value: p, label: languageLabel(p) }))}
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
      {dayStartOpen ? (
        <DayStartDialog
          current={profile.dayStartHour}
          onDismiss={() => setDayStartOpen(false)}
          onConfirm={(hour) => {
            setDayStartOpen(false);
            const moved = repositories.profile.setDayStartHour(hour);
            showUndo(
              moved > 0
                ? t('profile.dayStartMoved', { count: moved })
                : t('profile.dayStartUnchanged'),
            );
          }}
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
