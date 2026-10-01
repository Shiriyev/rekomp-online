import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { FAB, Text, TouchableRipple } from 'react-native-paper';

import { repositories } from '@/db';
import { useIngredientsMap, usePantryItems } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import { isLowStock } from '@/domain/stock';
import { INGREDIENT_CATEGORIES } from '@/domain/types';
import { quantityStep } from '@/domain/units';
import { INGREDIENT_IMAGES } from '@/features/images';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/features/ingredients';
import { showUndo } from '@/features/undo/undoStore';
import { currentLocale, useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';
import { QuantityStepper } from '@/ui/QuantityStepper';
import { SwipeToDelete } from '@/ui/SwipeToDelete';

import { useBulkAddStore } from './bulkAddStore';
import { PantryItemSheet, type PantryItemSheetHandle } from './PantryItemSheet';

type Row =
  | { type: 'header'; key: string; title: string }
  | { type: 'item'; key: string; ingredient: Ingredient; quantity: number };

export function HomeSegment() {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const items = usePantryItems();
  const ingredients = useIngredientsMap();
  const editRef = useRef<PantryItemSheetHandle>(null);

  const rows = useMemo<Row[]>(() => {
    const joined = items.flatMap((p) => {
      const ingredient = ingredients.get(p.ingredientId);
      return ingredient ? [{ ingredient, quantity: p.quantity }] : [];
    });
    return INGREDIENT_CATEGORIES.flatMap((category) => {
      const inCategory = joined
        .filter((j) => j.ingredient.category === category)
        .sort((a, b) =>
          content
            .ingredientName(a.ingredient)
            .localeCompare(content.ingredientName(b.ingredient), currentLocale()),
        );
      if (inCategory.length === 0) return [];
      return [
        { type: 'header' as const, key: `h:${category}`, title: CATEGORY_LABELS[category] },
        ...inCategory.map((j) => ({ type: 'item' as const, key: j.ingredient.id, ...j })),
      ];
    });
  }, [items, ingredients, content]);

  const openBulkAdd = () => {
    useBulkAddStore.getState().start('home');
    router.push('/bulk-add');
  };

  const remove = (ingredient: Ingredient, quantity: number) => {
    repositories.pantry.remove(ingredient.id);
    showUndo(t('pantry.home.removed', { name: content.ingredientName(ingredient) }), () =>
      repositories.pantry.setQuantity(ingredient.id, quantity),
    );
  };

  return (
    <View style={styles.flex}>
      {rows.length === 0 ? (
        <EmptyState
          icon="fridge-outline"
          title={t('pantry.home.emptyTitle')}
          description={t('pantry.home.emptyDescription')}
          actionLabel={t('pantry.home.emptyAction')}
          onAction={openBulkAdd}
        />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(r) => r.key}
          getItemType={(r) => r.type}
          contentContainerStyle={styles.list}
          renderItem={({ item: row }) => {
            if (row.type === 'header') {
              return (
                <Text
                  variant="titleSmall"
                  style={[styles.header, { color: theme.colors.primary }]}
                  accessibilityRole="header">
                  {row.title}
                </Text>
              );
            }
            const { ingredient, quantity } = row;
            const low = isLowStock(quantity, ingredient.unit, ingredient.lowStockThreshold);
            const step = quantityStep(ingredient.unit);
            return (
              <SwipeToDelete onDelete={() => remove(ingredient, quantity)}>
                <TouchableRipple
                  onPress={() => editRef.current?.open(ingredient, quantity)}
                  style={{ backgroundColor: theme.colors.background }}
                  accessibilityHint={t('pantry.home.editHint')}>
                  <View style={styles.row}>
                    <ImageWithFallback
                      source={
                        ingredient.imageKey ? INGREDIENT_IMAGES[ingredient.imageKey] : undefined
                      }
                      fallbackIcon={CATEGORY_ICONS[ingredient.category]}
                      style={styles.image}
                      iconSize={22}
                    />
                    <View style={styles.flex}>
                      <Text variant="bodyLarge">{content.ingredientName(ingredient)}</Text>
                      {low ? (
                        <Text variant="bodySmall" style={{ color: theme.colors.warning }}>
                          {quantity === 0 ? t('pantry.home.outOfStock') : t('pantry.home.lowStock')}
                        </Text>
                      ) : null}
                    </View>
                    <QuantityStepper
                      label={content.ingredientName(ingredient)}
                      valueText={formatAmount(quantity, ingredient.unit)}
                      decrementDisabled={quantity <= 0}
                      onDecrement={() => repositories.pantry.adjust(ingredient.id, -step)}
                      onIncrement={() => repositories.pantry.adjust(ingredient.id, step)}
                    />
                  </View>
                </TouchableRipple>
              </SwipeToDelete>
            );
          }}
        />
      )}

      <FAB
        icon="plus"
        label={t('pantry.home.fab')}
        style={styles.fab}
        onPress={openBulkAdd}
        accessibilityLabel={t('pantry.home.fabLabel')}
      />
      <PantryItemSheet ref={editRef} onRemove={remove} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 96 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    minHeight: 64,
  },
  image: { width: 40, height: 40, borderRadius: radius.sm },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
});
