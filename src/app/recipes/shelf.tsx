import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { cuisinesOf, shelfRecipes, SHELVES, type Shelf } from '@/domain/browse';
import { MEAL_TYPES, type MealType } from '@/domain/types';
import { RecipeCard } from '@/features/recipes/RecipeCard';
import { RecipeFilterBar } from '@/features/recipes/RecipeFilterBar';
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

/** Every recipe of one shelf as a two-column grid, with the same filters and sort. */
export default function ShelfScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ meal: string; shelf: string }>();
  const meal = isMealType(params.meal) ? params.meal : null;
  const shelf = isShelf(params.shelf) ? params.shelf : null;
  const ready = useTransitionDone();
  const { items, all, isLoaded, sortList } = useBrowseRecipes(meal);
  const clear = useRecipeFilters((s) => s.clear);
  // Without a chosen sort the shelf keeps its own order (e.g. «Не хватает 1–2» by what is missing).
  const rows = useMemo(
    () => (shelf ? sortList(shelfRecipes(items, shelf)) : []),
    [items, shelf, sortList],
  );
  const cuisines = useMemo(() => cuisinesOf(all), [all]);

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
        ListHeaderComponent={<RecipeFilterBar resultCount={rows.length} cuisines={cuisines} />}
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
              favorite={item.favorite}
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
  cell: { flex: 1, padding: spacing.xs },
});
