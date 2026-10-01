import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { useDayAggregates, useLatestLog, useProfile, useWeightLogs } from '@/db/hooks';
import type { MealLog } from '@/db/schema';
import { addDays } from '@/domain/dates';
import { dailySeries } from '@/domain/history';
import { DayCard } from '@/features/history/DayCard';
import { DeleteEntryDialog } from '@/features/history/DeleteEntryDialog';
import { planDelete, type DeletePlan } from '@/features/history/deleteEntry';
import { HistoryCharts } from '@/features/history/HistoryCharts';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatDayLabel, formatInt, formatTime } from '@/lib/format';
import { useClock } from '@/lib/useClock';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';

export default function HistoryScreen() {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const { today } = useClock();
  const yesterday = addDays(today, -1);
  const { profile } = useProfile();
  const days = useDayAggregates();
  const weights = useWeightLogs();
  const latest = useLatestLog();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([today]));
  const [deletePlan, setDeletePlan] = useState<DeletePlan | null>(null);

  const byDate = useMemo(() => new Map(days.map((d) => [d.localDate, d])), [days]);
  const week = useMemo(() => dailySeries(byDate, today, 7), [byDate, today]);
  const month = useMemo(() => dailySeries(byDate, today, 30), [byDate, today]);
  // Today is always listed, even before the first entry.
  const rows = useMemo(
    () =>
      byDate.has(today) ? days : [{ localDate: today, kcal: 0, protein: 0, entries: 0 }, ...days],
    [byDate, days, today],
  );

  if (!profile) return <SkeletonList rows={3} thumb={0} />;

  const askDelete = (log: MealLog) => setDeletePlan(planDelete(log));
  const toggle = (date: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });

  return (
    <View style={styles.flex}>
      <FlashList
        data={rows}
        keyExtractor={(d) => d.localDate}
        extraData={expanded}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <HistoryCharts
              week={week}
              month={month}
              today={today}
              targets={profile}
              weights={weights}
            />
            {latest ? (
              <Card mode="contained" style={styles.latest}>
                <Card.Content style={styles.latestRow}>
                  <View style={styles.flex}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t('history.latest', { time: formatTime(latest.timestamp) })}
                    </Text>
                    <Text variant="bodyLarge" numberOfLines={1}>
                      {t('history.latestLine', {
                        name: content.entryName(latest),
                        kcal: formatInt(latest.kcal),
                      })}
                    </Text>
                  </View>
                  <Button mode="outlined" icon="undo" onPress={() => askDelete(latest)}>
                    {t('common.actions.undo')}
                  </Button>
                </Card.Content>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="chart-timeline-variant" title={t('history.empty')} />}
        renderItem={({ item }) => (
          <DayCard
            label={formatDayLabel(item.localDate, today, yesterday)}
            localDate={item.localDate}
            totals={item}
            targets={profile}
            expanded={expanded.has(item.localDate)}
            onToggle={() => toggle(item.localDate)}
            onOpen={(log) =>
              router.push({ pathname: '/history/[logId]', params: { logId: log.id } })
            }
            onDelete={askDelete}
          />
        )}
      />
      <DeleteEntryDialog plan={deletePlan} onDone={() => setDeletePlan(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
  latest: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  latestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
