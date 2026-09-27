import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
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
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';
import { QuantityStepper } from '@/ui/QuantityStepper';
import { SwipeToDelete } from '@/ui/SwipeToDelete';

import { AddProductSheet } from './AddProductSheet';
import { PantryItemSheet, type PantryItemSheetHandle } from './PantryItemSheet';

type Row =
  | { type: 'header'; key: string; title: string }
  | { type: 'item'; key: string; ingredient: Ingredient; quantity: number };

export function HomeSegment() {
  const theme = useAppTheme();
  const items = usePantryItems();
  const ingredients = useIngredientsMap();
  const addRef = useRef<BottomSheetModal>(null);
  const editRef = useRef<PantryItemSheetHandle>(null);

  const rows = useMemo<Row[]>(() => {
    const joined = items.flatMap((p) => {
      const ingredient = ingredients.get(p.ingredientId);
      return ingredient ? [{ ingredient, quantity: p.quantity }] : [];
    });
    return INGREDIENT_CATEGORIES.flatMap((category) => {
      const inCategory = joined
        .filter((j) => j.ingredient.category === category)
        .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name, 'ru'));
      if (inCategory.length === 0) return [];
      return [
        { type: 'header' as const, key: `h:${category}`, title: CATEGORY_LABELS[category] },
        ...inCategory.map((j) => ({ type: 'item' as const, key: j.ingredient.id, ...j })),
      ];
    });
  }, [items, ingredients]);

  const remove = (ingredient: Ingredient, quantity: number) => {
    repositories.pantry.remove(ingredient.id);
    showUndo(`Убрано: ${ingredient.name}`, () =>
      repositories.pantry.setQuantity(ingredient.id, quantity),
    );
  };

  return (
    <View style={styles.flex}>
      {rows.length === 0 ? (
        <EmptyState
          icon="fridge-outline"
          title="Дома пока пусто"
          description="Добавь продукты — и блюда покажут, что можно приготовить."
          actionLabel="Добавить продукт"
          onAction={() => addRef.current?.present()}
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
                  accessibilityHint="Изменить количество и КБЖУ">
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
                      <Text variant="bodyLarge">{ingredient.name}</Text>
                      {low ? (
                        <Text variant="bodySmall" style={{ color: theme.colors.warning }}>
                          {quantity === 0 ? 'закончилось' : 'заканчивается'}
                        </Text>
                      ) : null}
                    </View>
                    <QuantityStepper
                      label={ingredient.name}
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
        label="Продукт"
        style={styles.fab}
        onPress={() => addRef.current?.present()}
        accessibilityLabel="Добавить продукт"
      />

      <AddProductSheet
        sheetRef={addRef}
        ingredients={[...ingredients.values()]}
        inPantry={new Set(items.map((i) => i.ingredientId))}
        onAdded={(ingredient, amount) =>
          showUndo(`Дома: +${formatAmount(amount, ingredient.unit)} ${ingredient.name}`)
        }
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
