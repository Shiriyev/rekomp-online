import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Switch, Text, TouchableRipple } from 'react-native-paper';

import {
  useIngredientsMap,
  usePantryStock,
  useRecipeCatalog,
  useRecipeLinesByRecipe,
} from '@/db/hooks';
import { recipeMacros } from '@/domain/nutrition';
import { canCook } from '@/domain/pantry';
import { applyAmounts } from '@/domain/recipeDraft';
import { RECIPE_SORTS, sortRecipes, type RecipeSort } from '@/domain/recipes';
import { MEAL_TYPES, type MealType } from '@/domain/types';
import { MEAL_LABELS } from '@/features/meals';
import { RecipeListItem } from '@/features/recipes/RecipeListItem';
import { useRecipeDraftStore } from '@/features/recipes/recipeDraftStore';
import { useKcalLeftToday } from '@/features/recipes/useKcalLeftToday';
import { spacing } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';

const SORT_LABELS: Record<RecipeSort, string> = {
  protein: 'Больше белка',
  kcal: 'Меньше ккал',
  time: 'Быстрее',
};

const isMealType = (v: unknown): v is MealType =>
  typeof v === 'string' && (MEAL_TYPES as readonly string[]).includes(v);

export default function RecipesScreen() {
  const params = useLocalSearchParams<{ mealType: string }>();
  const meal = isMealType(params.mealType) ? params.mealType : null;

  const catalog = useRecipeCatalog();
  const linesByRecipe = useRecipeLinesByRecipe();
  const ingredients = useIngredientsMap();
  const pantry = usePantryStock();
  const kcalLeft = useKcalLeftToday();
  const drafts = useRecipeDraftStore((s) => s.drafts);
  const [onlyCookable, setOnlyCookable] = useState(false);
  const [sort, setSort] = useState<RecipeSort>('protein');

  const items = useMemo(() => {
    if (!meal || !catalog.isLoaded || ingredients.size === 0) return [];
    const rows = catalog.recipes
      .filter((r) => r.mealType === meal)
      .map((recipe) => {
        // Amounts edited on a recipe card (draft) count here too.
        const draft = drafts[recipe.id];
        const lines = linesByRecipe.get(recipe.id) ?? [];
        const drafted = draft ? applyAmounts(lines, draft) : lines;
        return {
          recipe,
          macros: draft
            ? recipeMacros(drafted, ingredients).perServing
            : (catalog.macros.get(recipe.id) ?? { kcal: 0, protein: 0 }),
          check: canCook(drafted, ingredients, pantry, recipe.defaultServings),
          totalMinutes: recipe.totalMinutes,
          sortOrder: recipe.sortOrder,
        };
      });
    return sortRecipes(onlyCookable ? rows.filter((r) => r.check.status === 'ok') : rows, sort);
  }, [meal, catalog, linesByRecipe, drafts, ingredients, pantry, onlyCookable, sort]);

  if (!meal) return <EmptyState icon="alert-circle-outline" title="Такой категории нет" />;
  if (!catalog.isLoaded || ingredients.size === 0) {
    return (
      <>
        <Stack.Screen options={{ title: MEAL_LABELS[meal] }} />
        <SkeletonList />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: MEAL_LABELS[meal] }} />
      <FlashList
        data={items}
        keyExtractor={(item) => item.recipe.id}
        renderItem={({ item }) => (
          <RecipeListItem
            recipe={item.recipe}
            macros={item.macros}
            check={item.check}
            kcalLeftToday={kcalLeft}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <TouchableRipple
              onPress={() => setOnlyCookable((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: onlyCookable }}
              style={styles.switchRow}>
              <View style={styles.switchInner}>
                <Text variant="bodyLarge" style={styles.flex}>
                  Только из моих продуктов
                </Text>
                <Switch value={onlyCookable} onValueChange={setOnlyCookable} />
              </View>
            </TouchableRipple>
            <View style={styles.chips}>
              {RECIPE_SORTS.map((s) => (
                <Chip
                  key={s}
                  mode={sort === s ? 'flat' : 'outlined'}
                  selected={sort === s}
                  showSelectedCheck={false}
                  onPress={() => setSort(s)}>
                  {SORT_LABELS[s]}
                </Chip>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          onlyCookable ? (
            <EmptyState
              icon="fridge-off-outline"
              title="Из твоих продуктов пока ничего"
              description="Добавь продукты во вкладке «Продукты» или посмотри все блюда."
              actionLabel="Показать все"
              onAction={() => setOnlyCookable(false)}
            />
          ) : null
        }
        contentContainerStyle={styles.list}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: spacing.xl },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  switchRow: { borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  switchInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
