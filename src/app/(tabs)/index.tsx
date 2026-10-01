import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Avatar, Card, Chip, FAB, Text } from 'react-native-paper';

import { repositories } from '@/db';
import {
  useActiveCook,
  useAvailablePortions,
  useDailyProtein,
  useDayLogs,
  useProfile,
  useRecipeCatalog,
} from '@/db/hooks';
import type { AvailablePortion } from '@/db/repositories/portionsRepo';
import type { MealType } from '@/domain/types';
import { proteinStreak } from '@/domain/cooking';
import { addDays } from '@/domain/dates';
import { kcalRangeByMeal, proteinNudge, suggestMealType, summarizeDay } from '@/domain/today';
import { MealCategoryGrid } from '@/features/today/MealCategoryGrid';
import { PortionsStrip } from '@/features/today/PortionsStrip';
import { ProteinNudgeCard } from '@/features/today/ProteinNudgeCard';
import { TodaySummaryCard } from '@/features/today/TodaySummaryCard';
import { showUndo } from '@/features/undo/undoStore';
import { t as translate, useT } from '@/i18n';
import { content, useContent } from '@/i18n/content';
import { useClock } from '@/lib/useClock';
import { spacing } from '@/theme';
import { SkeletonBlock } from '@/ui/Skeleton';

const STREAK_WINDOW_DAYS = 60;

export default function TodayScreen() {
  const t = useT();
  const c = useContent();
  const { now, today } = useClock();
  const { profile } = useProfile();
  const logs = useDayLogs(today);
  const portions = useAvailablePortions();
  const catalog = useRecipeCatalog();
  const activeCook = useActiveCook();
  const since = addDays(today, -STREAK_WINDOW_DAYS);
  const dailyProtein = useDailyProtein(since);

  const summary = useMemo(() => summarizeDay(logs), [logs]);
  const kcalRanges = useMemo(() => kcalRangeByMeal(catalog.recipes, catalog.macros), [catalog]);
  // First recipe of each meal (catalog order) gives the tile its photo.
  const coverImages = useMemo(() => {
    const covers: Partial<Record<MealType, string>> = {};
    for (const r of catalog.recipes)
      if (r.imageKey && !covers[r.mealType]) covers[r.mealType] = r.imageKey;
    return covers;
  }, [catalog]);
  const snackSuggestions = useMemo(
    () =>
      catalog.recipes
        .filter((r) => r.mealType === 'snack')
        .map((r) => ({
          id: r.id,
          name: c.recipeName(r),
          protein: catalog.macros.get(r.id)?.protein ?? 0,
        }))
        .sort((a, b) => b.protein - a.protein)
        .slice(0, 2),
    [catalog, c],
  );

  if (!profile || !catalog.isLoaded) {
    return (
      <View style={styles.content} accessibilityLabel={t('common.loading')}>
        <SkeletonBlock height={260} rounded={16} />
        <SkeletonBlock height={24} width="50%" />
        <SkeletonBlock height={180} rounded={16} />
      </View>
    );
  }
  const nudge = proteinNudge(now, summary.total.protein, profile.proteinMinG);
  const mealNow = suggestMealType(now);
  const streak = proteinStreak(dailyProtein, profile.proteinMinG, today);

  const eatPortion = (p: AvailablePortion) => {
    const log = repositories.portions.eat(p.id, mealNow);
    showUndo(
      translate('today.portionEaten', {
        name: content.recipeName({ id: p.recipeId, name: p.recipeName }),
      }),
      () => repositories.logs.undo(log.id),
    );
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {activeCook ? (
          <Card
            mode="contained"
            onPress={() =>
              router.push({ pathname: '/cook/[id]', params: { id: activeCook.recipeId } })
            }
            accessibilityHint={t('today.continueCookingHint')}>
            <Card.Title
              title={t('today.continueCooking')}
              subtitle={c.recipeName({ id: activeCook.recipeId, name: activeCook.recipeName })}
              left={(props) => <Avatar.Icon {...props} icon="chef-hat" />}
            />
          </Card>
        ) : null}
        <Animated.View entering={FadeIn.duration(250)}>
          <TodaySummaryCard summary={summary} targets={profile} />
        </Animated.View>
        {streak >= 2 ? (
          <Chip
            icon="fire"
            style={styles.streak}
            accessibilityLabel={t('today.streak', { count: streak })}>
            {t('today.streak', { count: streak })}
          </Chip>
        ) : null}
        {nudge !== null ? <ProteinNudgeCard grams={nudge} suggestions={snackSuggestions} /> : null}
        <PortionsStrip portions={portions} onEat={eatPortion} />
        <Text variant="titleMedium" accessibilityRole="header">
          {t('today.whatToCook')}
        </Text>
        <MealCategoryGrid kcalRanges={kcalRanges} coverImages={coverImages} />
      </ScrollView>

      <FAB
        icon="plus"
        label={t('today.fab')}
        accessibilityLabel={t('today.fabA11y')}
        style={styles.fab}
        onPress={() => router.push('/add-meal')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Bottom padding keeps the last tiles clear of the FAB.
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 96 },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
  streak: { alignSelf: 'flex-start' },
});
