import { FlashList } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput, TouchableRipple } from 'react-native-paper';

import { buildShelves, type Shelf } from '@/domain/browse';
import { MEAL_TYPES, type MealType } from '@/domain/types';
import { MEAL_LABELS } from '@/features/meals';
import { RecipeCard } from '@/features/recipes/RecipeCard';
import { RecipeFilterChips } from '@/features/recipes/RecipeFilterChips';
import { useRecipeFilters } from '@/features/recipes/recipeFiltersStore';
import { useBrowseRecipes, type BrowseItem } from '@/features/recipes/useBrowseRecipes';
import { useT } from '@/i18n';
import { useTransitionDone } from '@/lib/useTransitionDone';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';

const isMealType = (v: unknown): v is MealType =>
  typeof v === 'string' && (MEAL_TYPES as readonly string[]).includes(v);

/** Width of a card in a shelf: two and a bit fit, so the row reads as scrollable. */
const SHELF_CARD_WIDTH = 164;
/** A shelf shows its first recipes; «Все» opens the full grid. */
const SHELF_PREVIEW = 12;

/**
 * Recipes of one meal: search, quick filters («Нет плиты», «Без свинины», …) and shelves
 * («Можно приготовить сейчас», «Курица», …) that scroll sideways; «Все» opens a grid.
 */
export default function RecipesScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ mealType: string }>();
  const meal = isMealType(params.mealType) ? params.mealType : null;
  const [query, setQuery] = useState('');
  const ready = useTransitionDone();
  const { items, isLoaded } = useBrowseRecipes(meal, query);
  const clear = useRecipeFilters((s) => s.clear);
  const shelves = useMemo(() => buildShelves(items), [items]);

  if (!meal) return <EmptyState icon="alert-circle-outline" title={t('recipes.noCategory')} />;
  const title = <Stack.Screen options={{ title: MEAL_LABELS[meal] }} />;
  if (!ready || !isLoaded) {
    return (
      <>
        {title}
        <SkeletonList still={!ready} />
      </>
    );
  }

  const header = (
    <View>
      <View style={styles.search}>
        <TextInput
          mode="outlined"
          dense
          placeholder={t('recipes.browse.search')}
          accessibilityLabel={t('recipes.browse.search')}
          value={query}
          onChangeText={setQuery}
          left={<TextInput.Icon icon="magnify" />}
          right={query ? <TextInput.Icon icon="close" onPress={() => setQuery('')} /> : undefined}
          autoCorrect={false}
        />
      </View>
      <RecipeFilterChips />
    </View>
  );
  const empty = (
    <EmptyState
      icon="silverware-variant"
      title={t('recipes.browse.nothing')}
      description={t('recipes.browse.nothingHint')}
      actionLabel={t('recipes.browse.clearFilters')}
      onAction={() => {
        clear();
        setQuery('');
      }}
    />
  );

  // Searching shows one grid of matches instead of shelves.
  if (query.trim()) {
    return (
      <>
        {title}
        <FlashList
          data={items}
          numColumns={2}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => <GridCell item={item} meal={meal} />}
        />
      </>
    );
  }

  return (
    <>
      {title}
      <FlashList
        data={shelves}
        keyExtractor={(s) => s.shelf}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ShelfRow shelf={item.shelf} items={item.recipes} meal={meal} />}
      />
    </>
  );
}

const ShelfRow = memo(function ShelfRow({
  shelf,
  items,
  meal,
}: {
  shelf: Shelf;
  items: BrowseItem[];
  meal: MealType;
}) {
  const t = useT();
  const theme = useAppTheme();
  const open = () => router.push({ pathname: '/recipes/shelf', params: { meal, shelf } });
  return (
    <View style={styles.shelf}>
      <TouchableRipple
        onPress={open}
        accessibilityRole="button"
        accessibilityHint={t('recipes.browse.seeAll')}>
        <View style={styles.shelfHeader}>
          <View style={styles.flex}>
            <Text variant="titleMedium" accessibilityRole="header">
              {t(`recipes.shelves.${shelf}`)}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('recipes.browse.shelfCount', { count: items.length })}
            </Text>
          </View>
          <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
            {t('recipes.browse.seeAll')} ›
          </Text>
        </View>
      </TouchableRipple>
      <FlashList
        horizontal
        data={items.slice(0, SHELF_PREVIEW)}
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shelfRow}
        ItemSeparatorComponent={Gap}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item.recipe}
            macros={item.macros}
            missing={item.missing}
            meal={meal}
            width={SHELF_CARD_WIDTH}
          />
        )}
      />
    </View>
  );
});

function GridCell({ item, meal }: { item: BrowseItem; meal: MealType }) {
  return (
    <View style={styles.cell}>
      <RecipeCard recipe={item.recipe} macros={item.macros} missing={item.missing} meal={meal} />
    </View>
  );
}

const Gap = () => <View style={styles.gap} />;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  list: { paddingBottom: spacing.xl },
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  cell: { flex: 1, padding: spacing.xs },
  shelf: { paddingTop: spacing.md },
  shelfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  shelfRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  gap: { width: spacing.sm },
});
