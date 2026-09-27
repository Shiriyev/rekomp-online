import { FlashList } from '@shopify/flash-list';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { useDayAggregates, useLatestLog, useProfile, useWeightLogs } from '@/db/hooks';
import type { MealLog } from '@/db/schema';
import { addDays } from '@/domain/dates';
import { dailySeries } from '@/domain/history';
import { DayCard } from '@/features/history/DayCard';
import { DeleteEntryDialog } from '@/features/history/DeleteEntryDialog';
import { planDelete, type DeletePlan } from '@/features/history/deleteEntry';
import { EditEntrySheet, type EditEntrySheetHandle } from '@/features/history/EditEntrySheet';
import { HistoryCharts } from '@/features/history/HistoryCharts';
import { formatDayLabel, formatInt, formatTime } from '@/lib/format';
import { useClock } from '@/lib/useClock';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';

export default function HistoryScreen() {
  const theme = useAppTheme();
  const { today } = useClock();
  const yesterday = addDays(today, -1);
  const { profile } = useProfile();
  const days = useDayAggregates();
  const weights = useWeightLogs();
  const latest = useLatestLog();
  const editRef = useRef<EditEntrySheetHandle>(null);
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

  if (!profile) return null;

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
                      Последняя запись · {formatTime(latest.timestamp)}
                    </Text>
                    <Text variant="bodyLarge" numberOfLines={1}>
                      {latest.name} · {formatInt(latest.kcal)} ккал
                    </Text>
                  </View>
                  <Button mode="outlined" icon="undo" onPress={() => askDelete(latest)}>
                    Отменить
                  </Button>
                </Card.Content>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="chart-timeline-variant" title="Пока нет записей" />}
        renderItem={({ item }) => (
          <DayCard
            label={formatDayLabel(item.localDate, today, yesterday)}
            localDate={item.localDate}
            totals={item}
            targets={profile}
            expanded={expanded.has(item.localDate)}
            onToggle={() => toggle(item.localDate)}
            onEdit={(log) => editRef.current?.open(log)}
            onDelete={askDelete}
          />
        )}
      />
      <EditEntrySheet ref={editRef} onDelete={askDelete} />
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
