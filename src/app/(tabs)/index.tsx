import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FAB, Snackbar, Text } from 'react-native-paper';

import { repositories } from '@/db';
import {
  useAvailablePortions,
  useDayLogs,
  useProfile,
  useRecentPresets,
  useRecipeCatalog,
} from '@/db/hooks';
import type { AvailablePortion } from '@/db/repositories/portionsRepo';
import type { ManualLogInput } from '@/domain/schemas';
import { kcalRangeByMeal, proteinNudge, suggestMealType, summarizeDay } from '@/domain/today';
import { ManualEntrySheet } from '@/features/today/ManualEntrySheet';
import { MealCategoryGrid } from '@/features/today/MealCategoryGrid';
import { PortionsStrip } from '@/features/today/PortionsStrip';
import { ProteinNudgeCard } from '@/features/today/ProteinNudgeCard';
import { TodaySummaryCard } from '@/features/today/TodaySummaryCard';
import { useClock } from '@/lib/useClock';
import { spacing } from '@/theme';

const UNDO_MS = 10_000;

type Undo = { message: string; run: () => void };

export default function TodayScreen() {
  const { now, today } = useClock();
  const { profile } = useProfile();
  const logs = useDayLogs(today);
  const portions = useAvailablePortions();
  const presets = useRecentPresets();
  const catalog = useRecipeCatalog();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [undo, setUndo] = useState<Undo | null>(null);

  const summary = useMemo(() => summarizeDay(logs), [logs]);
  const kcalRanges = useMemo(() => kcalRangeByMeal(catalog.recipes, catalog.macros), [catalog]);
  const snackSuggestions = useMemo(
    () =>
      catalog.recipes
        .filter((r) => r.mealType === 'snack')
        .map((r) => ({ id: r.id, name: r.name, protein: catalog.macros.get(r.id)?.protein ?? 0 }))
        .sort((a, b) => b.protein - a.protein)
        .slice(0, 2),
    [catalog],
  );

  if (!profile) return null;
  const nudge = proteinNudge(now, summary.total.protein, profile.proteinMinG);
  const mealNow = suggestMealType(now);

  const addManual = (input: ManualLogInput) => {
    const log = repositories.logs.addManual(input);
    setUndo({ message: `Добавлено: ${log.name}`, run: () => repositories.logs.undo(log.id) });
  };

  const eatPortion = (p: AvailablePortion) => {
    const log = repositories.portions.eat(p.id, mealNow);
    setUndo({
      message: `Съедена порция: ${p.recipeName}`,
      run: () => repositories.logs.undo(log.id),
    });
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <TodaySummaryCard summary={summary} targets={profile} />
        {nudge !== null ? <ProteinNudgeCard grams={nudge} suggestions={snackSuggestions} /> : null}
        <PortionsStrip portions={portions} onEat={eatPortion} />
        <Text variant="titleMedium" accessibilityRole="header">
          Что приготовить
        </Text>
        <MealCategoryGrid kcalRanges={kcalRanges} />
      </ScrollView>

      <FAB
        icon="plus"
        label="Добавить"
        accessibilityLabel="Добавить вручную"
        style={styles.fab}
        onPress={() => sheetRef.current?.present()}
      />

      <ManualEntrySheet
        sheetRef={sheetRef}
        defaultMealType={mealNow}
        presets={presets}
        onSubmit={addManual}
      />

      <Snackbar
        visible={undo !== null}
        onDismiss={() => setUndo(null)}
        duration={UNDO_MS}
        // Material: a snackbar sits above the FAB instead of covering it.
        wrapperStyle={styles.snackbar}
        action={{
          label: 'Отменить',
          onPress: () => {
            undo?.run();
            setUndo(null);
          },
        }}>
        {undo?.message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Bottom padding keeps the last tiles clear of the FAB.
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 96 },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
  snackbar: { bottom: 72 },
});
