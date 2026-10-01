import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Card, Divider, IconButton, Text, TouchableRipple } from 'react-native-paper';

import { useDayLogs } from '@/db/hooks';
import type { MealLog } from '@/db/schema';
import { dayVerdict } from '@/domain/history';
import type { Macros } from '@/domain/types';
import { MEAL_ICONS, MEAL_LABELS } from '@/features/meals';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatInt, formatTime } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';

type Props = {
  label: string;
  localDate: string;
  totals: Macros;
  targets: { kcalTarget: number; proteinMinG: number };
  expanded: boolean;
  onToggle: () => void;
  onOpen: (log: MealLog) => void;
  onDelete: (log: MealLog) => void;
};

const SOURCE_ICON = {
  manual: 'pencil-outline',
  recipe: 'chef-hat',
  portion: 'fridge-outline',
} as const;

export function DayCard({
  label,
  localDate,
  totals,
  targets,
  expanded,
  onToggle,
  onOpen,
  onDelete,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const verdict = dayVerdict(totals, targets);
  const kcalColor =
    verdict.kcal === 'ok'
      ? theme.colors.success
      : verdict.kcal === 'over'
        ? theme.colors.error
        : theme.colors.warning;
  const proteinColor = verdict.protein === 'ok' ? theme.colors.success : theme.colors.warning;
  const kcalWord = t(`history.day.verdict.${verdict.kcal}`);

  return (
    <Card mode="outlined" style={styles.card}>
      <TouchableRipple
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t('history.day.a11y', {
          label,
          kcal: formatInt(totals.kcal),
          verdict: kcalWord,
          protein: formatInt(totals.protein),
        })}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text variant="titleMedium">{label}</Text>
            <View style={styles.totals}>
              <Text variant="bodyMedium" style={{ color: kcalColor }}>
                {t('history.day.totalKcal', {
                  kcal: formatInt(totals.kcal),
                  target: formatInt(targets.kcalTarget),
                })}
              </Text>
              <Text variant="bodyMedium" style={{ color: proteinColor }}>
                {t('common.proteinValue', { value: formatInt(totals.protein) })}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={theme.colors.onSurfaceVariant}
          />
        </View>
      </TouchableRipple>
      {expanded ? <DayEntries localDate={localDate} onOpen={onOpen} onDelete={onDelete} /> : null}
    </Card>
  );
}

function DayEntries({
  localDate,
  onOpen,
  onDelete,
}: {
  localDate: string;
  onOpen: (log: MealLog) => void;
  onDelete: (log: MealLog) => void;
}) {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const logs = useDayLogs(localDate);

  if (logs.length === 0) {
    return (
      <Text variant="bodyMedium" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
        {t('history.day.noEntries')}
      </Text>
    );
  }

  return (
    <View>
      {logs.map((log) => (
        <View key={log.id}>
          <Divider />
          <TouchableRipple
            onPress={() => onOpen(log)}
            accessibilityHint={t('history.day.openHint')}>
            <View style={styles.entry}>
              {log.photoUri ? (
                <Image
                  source={{ uri: log.photoUri }}
                  style={styles.thumb}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                  accessible={false}
                />
              ) : (
                <MaterialCommunityIcons
                  name={
                    log.source === 'manual' ? MEAL_ICONS[log.mealType] : SOURCE_ICON[log.source]
                  }
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                  importantForAccessibility="no"
                />
              )}
              <View style={styles.flex}>
                <Text variant="bodyLarge" numberOfLines={1}>
                  {content.entryName(log)}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {formatTime(log.timestamp)} · {MEAL_LABELS[log.mealType]}
                </Text>
              </View>
              <View style={styles.entryMacros}>
                <Text variant="titleSmall">{formatInt(log.kcal)}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('history.day.proteinShort', { value: formatInt(log.protein) })}
                </Text>
              </View>
              <IconButton
                icon="delete-outline"
                onPress={() => onDelete(log)}
                accessibilityLabel={t('history.day.deleteEntry', { name: content.entryName(log) })}
              />
            </View>
          </TouchableRipple>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  totals: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    gap: spacing.md,
    minHeight: 56,
  },
  entryMacros: { alignItems: 'flex-end' },
  thumb: { width: 36, height: 36, borderRadius: radius.sm },
  empty: { padding: spacing.lg, paddingTop: 0 },
});
