import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, Surface, Text, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { repositories } from '@/db';
import {
  useIngredientsMap,
  usePantryItems,
  useRecipeCatalog,
  useRecipeLinesByRecipe,
} from '@/db/hooks';
import { defaultAddAmount } from '@/domain/bulkAdd';
import { isLowStock } from '@/domain/stock';
import { quantityStep } from '@/domain/units';
import { bundledImage } from '@/features/bundledImage';
import { CATEGORY_ICONS, useCategoryLabel } from '@/features/ingredients';
import { MEAL_ICONS } from '@/features/meals';
import { recipeImage } from '@/features/recipes/recipeImage';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount, formatDecimal, formatInt, formatKcal } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

/**
 * Product card: photo, nutrition per 100 g, how much is at home (with −/+), and the recipes
 * that use it (tap → the recipe).
 */
export default function ProductScreen() {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const categoryLabel = useCategoryLabel();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ingredients = useIngredientsMap();
  const pantry = usePantryItems();
  const catalog = useRecipeCatalog();
  const linesByRecipe = useRecipeLinesByRecipe();
  const ingredient = ingredients.get(id);
  const quantity = pantry.find((p) => p.ingredientId === id)?.quantity ?? null;

  const usedIn = useMemo(
    () =>
      catalog.recipes.filter((r) =>
        (linesByRecipe.get(r.id) ?? []).some((l) => l.ingredientId === id),
      ),
    [catalog.recipes, linesByRecipe, id],
  );

  const title = <Stack.Screen options={{ title: t('products.card.title') }} />;
  if (!ingredient) {
    return (
      <>
        {title}
        {ingredients.size > 0 ? (
          <EmptyState icon="alert-circle-outline" title={t('products.card.notFound')} />
        ) : null}
      </>
    );
  }

  const name = content.ingredientName(ingredient);
  const otherNames = [ingredient.name, ingredient.nameEn, ingredient.nameHu].filter(
    (n): n is string => Boolean(n) && n !== name,
  );
  const subcategory = ingredient.subcategory
    ? t(
        `products.subcategories.${ingredient.category}.${ingredient.subcategory}` as 'products.subcategories.other.other',
        { defaultValue: '' },
      )
    : '';
  const step = quantityStep(ingredient.unit);
  const low =
    quantity !== null && isLowStock(quantity, ingredient.unit, ingredient.lowStockThreshold);
  const nutrients: { label: string; value: string }[] = [
    { label: t('products.card.kcal'), value: formatInt(ingredient.kcalPer100g) },
    {
      label: t('products.card.protein'),
      value: t('products.card.grams', { value: formatDecimal(ingredient.proteinPer100g) }),
    },
    ...(ingredient.fatPer100g !== null
      ? [
          {
            label: t('products.card.fat'),
            value: t('products.card.grams', { value: formatDecimal(ingredient.fatPer100g) }),
          },
        ]
      : []),
    ...(ingredient.carbsPer100g !== null
      ? [
          {
            label: t('products.card.carbs'),
            value: t('products.card.grams', { value: formatDecimal(ingredient.carbsPer100g) }),
          },
        ]
      : []),
  ];
  const source = ingredient.isCustom
    ? 'own'
    : ingredient.source === 'usda' || ingredient.source === 'manual'
      ? ingredient.source
      : null;

  return (
    <>
      {title}
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}>
        <ImageWithFallback
          source={bundledImage(ingredient.imageKey)}
          fallbackIcon={CATEGORY_ICONS[ingredient.category]}
          style={styles.photo}
          iconSize={56}
        />
        <View style={styles.body}>
          <View style={styles.gapXs}>
            <Text variant="headlineSmall" accessibilityRole="header">
              {name}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {[categoryLabel(ingredient.category), subcategory].filter(Boolean).join(' · ')}
            </Text>
            {otherNames.length > 0 ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {otherNames.join(' · ')}
              </Text>
            ) : null}
          </View>

          <View style={styles.gapSm}>
            <Text variant="titleMedium">{t('products.card.per100')}</Text>
            <View style={styles.nutrients}>
              {nutrients.map((n) => (
                <Surface key={n.label} elevation={1} style={styles.nutrient}>
                  <Text variant="titleMedium">{n.value}</Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {n.label}
                  </Text>
                </Surface>
              ))}
            </View>
            {ingredient.unit === 'pcs' && ingredient.gramsPerPiece ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('products.card.perPiece', { grams: formatInt(ingredient.gramsPerPiece) })}
              </Text>
            ) : null}
            {source ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {t(`products.card.source.${source}`)}
              </Text>
            ) : null}
          </View>

          <Surface elevation={1} style={styles.stock}>
            <View style={styles.flex}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('products.card.atHome')}
              </Text>
              <Text
                variant="titleLarge"
                style={low ? { color: theme.colors.warning } : undefined}
                accessibilityLiveRegion="polite">
                {quantity !== null
                  ? formatAmount(quantity, ingredient.unit)
                  : t('products.card.notAtHome')}
              </Text>
            </View>
            {quantity !== null ? (
              <>
                <IconButton
                  icon="minus"
                  mode="outlined"
                  disabled={quantity <= 0}
                  onPress={() => repositories.pantry.adjust(ingredient.id, -step)}
                  accessibilityLabel={t('ui.stepper.decrement', { label: name })}
                />
                <IconButton
                  icon="plus"
                  mode="outlined"
                  onPress={() => repositories.pantry.adjust(ingredient.id, step)}
                  accessibilityLabel={t('ui.stepper.increment', { label: name })}
                />
              </>
            ) : ingredient.isArchived ? null : (
              <Button
                mode="contained-tonal"
                icon="plus"
                onPress={() =>
                  repositories.pantry.setQuantity(
                    ingredient.id,
                    defaultAddAmount(ingredient, ingredient.lastAddedAmount),
                  )
                }>
                {t('products.card.addHome')}
              </Button>
            )}
          </Surface>

          <View style={styles.gapSm}>
            <Text variant="titleMedium">
              {usedIn.length > 0
                ? t('products.card.recipes', { count: usedIn.length })
                : t('products.card.noRecipes')}
            </Text>
            {usedIn.map((r) => {
              const macros = catalog.macros.get(r.id);
              return (
                <TouchableRipple
                  key={r.id}
                  borderless
                  style={styles.recipe}
                  onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: r.id } })}
                  accessibilityRole="button">
                  <View style={styles.recipeInner}>
                    <ImageWithFallback
                      source={recipeImage(r)}
                      fallbackIcon={MEAL_ICONS[r.mealType]}
                      style={styles.recipeImage}
                      iconSize={22}
                    />
                    <View style={styles.flex}>
                      <Text variant="titleSmall" numberOfLines={2}>
                        {content.recipeName(r)}
                      </Text>
                      {macros ? (
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {t('recipes.browse.cardMeta', {
                            kcal: formatKcal(macros.kcal),
                            protein: formatInt(macros.protein),
                          })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableRipple>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapXs: { gap: spacing.xs },
  gapSm: { gap: spacing.sm },
  photo: { width: '100%', aspectRatio: 16 / 10 },
  body: { padding: spacing.lg, gap: spacing.lg },
  nutrients: { flexDirection: 'row', gap: spacing.sm },
  nutrient: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  stock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  recipe: { borderRadius: radius.md },
  recipeInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  recipeImage: { width: 56, height: 56, borderRadius: radius.sm },
});
