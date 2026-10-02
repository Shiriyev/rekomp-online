import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';

import { shelfRecipes, SHELVES, type Shelf } from '@/domain/browse';
import { RECIPE_SORTS, sortRecipes, type RecipeSort } from '@/domain/recipes';
import { MEAL_TYPES, type MealType } from '@/domain/types';
import { RecipeCard } from '@/features/recipes/RecipeCard';
import { RecipeFilterChips } from '@/features/recipes/RecipeFilterChips';
import { useRecipeFilters } from '@/features/recipes/recipeFiltersStore';
import { useBrowseRecipes } from '@/features/recipes/useBrowseRecipes';
import { useT } from '@/i18n';
import { useTransitionDone } from '@/lib/useTransitionDone';
import { spacing } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';

const isMealType = (v: unknown): v is MealType =>
  typeof v === 'string' && (MEAL_TYPES as readonly string[]).includes(v);
const isShelf = (v: unknown): v is Shelf =>
  typeof v === 'string' && (SHELVES as readonly string[]).includes(v);

/** Every recipe of one shelf as a two-column grid, with the same quick filters. */
export default function ShelfScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ meal: string; shelf: string }>();
  const meal = isMealType(params.meal) ? params.meal : null;
  const shelf = isShelf(params.shelf) ? params.shelf : null;
  const ready = useTransitionDone();
  const { items, isLoaded } = useBrowseRecipes(meal);
  const clear = useRecipeFilters((s) => s.clear);
  // null keeps the shelf's own order (e.g. «Не хватает 1–2» by what is missing).
  const [sort, setSort] = useState<RecipeSort | null>(null);

  const rows = useMemo(() => {
    if (!shelf) return [];
    const inShelf = shelfRecipes(items, shelf);
    return sort ? sortRecipes(inShelf, sort) : inShelf;
  }, [items, shelf, sort]);

  if (!meal || !shelf) {
    return <EmptyState icon="alert-circle-outline" title={t('recipes.noCategory')} />;
  }
  const title = <Stack.Screen options={{ title: t(`recipes.shelves.${shelf}`) }} />;
  if (!ready || !isLoaded) {
    return (
      <>
        {title}
        <SkeletonList still={!ready} />
      </>
    );
  }

  return (
    <>
      {title}
      <FlashList
        data={rows}
        numColumns={2}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={
          <View>
            <RecipeFilterChips />
            <View style={styles.sorts}>
              {RECIPE_SORTS.map((s) => (
                <Chip
                  key={s}
                  compact
                  mode={sort === s ? 'flat' : 'outlined'}
                  selected={sort === s}
                  showSelectedCheck={false}
                  onPress={() => setSort((cur) => (cur === s ? null : s))}>
                  {t(`recipes.sort.${s}` as const)}
                </Chip>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="silverware-variant"
            title={t('recipes.browse.nothing')}
            description={t('recipes.browse.nothingHint')}
            actionLabel={t('recipes.browse.clearFilters')}
            onAction={clear}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <RecipeCard
              recipe={item.recipe}
              macros={item.macros}
              missing={item.missing}
              meal={meal}
            />
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  sorts: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  cell: { flex: 1, padding: spacing.xs },
});
