import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  StyleSheet,
  View,
  type TextInput as NativeTextInput,
} from 'react-native';
import { Button, IconButton, Surface, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { repositories } from '@/db';
import { useIngredientsMap, usePantryItems } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import { afterAdding, bulkStep } from '@/domain/bulkAdd';
import { INGREDIENT_IMAGES } from '@/features/images';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { useBulkAddStore } from '@/features/pantry/bulkAddStore';
import { showUndo } from '@/features/undo/undoStore';
import { formatAmount, pluralRu } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { AmountInput } from '@/ui/AmountInput';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';
import { SwipeToDelete } from '@/ui/SwipeToDelete';

const products = (n: number) => `${n} ${pluralRu(n, ['продукт', 'продукта', 'продуктов'])}`;

/** «Количество»: one stepper per picked product, then everything in one transaction. */
export default function BulkAmountsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const ingredients = useIngredientsMap();
  const pantry = usePantryItems();
  const { source, selected, amounts, shoppingItems, setAmount, remove, clear } = useBulkAddStore();
  const listRef = useRef<FlashListRef<Ingredient>>(null);
  const inputs = useRef(new Map<number, NativeTextInput | null>());
  const container = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  const [saving, setSaving] = useState(false);

  const rows = selected.flatMap((id) => {
    const i = ingredients.get(id);
    return i ? [i] : [];
  });
  const stock = new Map(pantry.map((p) => [p.ingredientId, p.quantity]));

  const focusNext = (index: number) => {
    const next = index + 1;
    if (next >= rows.length) return;
    listRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.4 });
    // The next row may only mount after scrolling.
    setTimeout(() => inputs.current.get(next)?.focus(), 150);
  };

  const addAll = () => {
    if (saving) return;
    setSaving(true);
    try {
      if (source === 'shopping') {
        const ids = repositories.shopping.checkMany(
          rows.flatMap((i) => {
            const itemId = shoppingItems[i.id];
            return itemId ? [{ itemId, amount: amounts[i.id] ?? 0 }] : [];
          }),
        );
        showUndo(`Куплено и добавлено домой: ${products(ids.length)}`, () =>
          repositories.shopping.uncheckMany(ids),
        );
      } else {
        const result = repositories.pantry.addMany(
          rows.map((i) => ({ ingredientId: i.id, amount: amounts[i.id] ?? 0 })),
        );
        showUndo(`Добавлено ${products(result.items.length)}`, () =>
          repositories.pantry.undoAddMany(result),
        );
      }
      clear();
      router.dismissTo('/pantry');
    } catch (e) {
      showUndo(e instanceof Error ? `Не удалось добавить: ${e.message}` : 'Не удалось добавить');
    } finally {
      setSaving(false);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="basket-outline"
        title="Ничего не выбрано"
        actionLabel="Назад"
        onAction={() => router.back()}
      />
    );
  }

  const invalid = rows.some((i) => !((amounts[i.id] ?? 0) > 0));

  return (
    <View
      ref={container}
      style={styles.flex}
      onLayout={() => container.current?.measureInWindow((_x, y) => setOffset(y))}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={offset}>
        <FlashList
          ref={listRef}
          data={rows}
          keyExtractor={(i) => i.id}
          extraData={amounts}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const amount = amounts[item.id] ?? 0;
            const have = stock.get(item.id);
            const after = afterAdding(have ?? null, amount, item.unit);
            return (
              <SwipeToDelete onDelete={() => remove(item.id)} label="Убрать">
                <View style={[styles.row, { backgroundColor: theme.colors.background }]}>
                  <ImageWithFallback
                    source={item.imageKey ? INGREDIENT_IMAGES[item.imageKey] : undefined}
                    fallbackIcon={CATEGORY_ICONS[item.category]}
                    style={styles.image}
                    iconSize={22}
                  />
                  <View style={styles.flex}>
                    <Text variant="bodyLarge" numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {have !== undefined
                        ? `было ${formatAmount(have, item.unit)} → станет ${formatAmount(after, item.unit)}`
                        : `станет ${formatAmount(after, item.unit)}`}
                    </Text>
                    <AmountInput
                      label={item.name}
                      value={amount}
                      onChange={(n) => setAmount(item.id, n)}
                      unit={item.unit}
                      step={bulkStep(item.unit)}
                      inputRef={(r) => {
                        inputs.current.set(index, r);
                      }}
                      returnKeyType={index < rows.length - 1 ? 'next' : 'done'}
                      onSubmitEditing={index < rows.length - 1 ? () => focusNext(index) : undefined}
                    />
                  </View>
                  <IconButton
                    icon="close"
                    onPress={() => remove(item.id)}
                    accessibilityLabel={`Убрать из списка: ${item.name}`}
                  />
                </View>
              </SwipeToDelete>
            );
          }}
        />
        <Surface elevation={2} style={[styles.bar, { paddingBottom: spacing.md + insets.bottom }]}>
          <Button
            mode="contained"
            icon="check"
            onPress={addAll}
            disabled={saving || invalid}
            contentStyle={styles.submit}>
            {source === 'shopping'
              ? `Купил, добавить всё (${rows.length})`
              : `Добавить всё (${rows.length})`}
          </Button>
        </Surface>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.sm,
  },
  image: { width: 48, height: 48, borderRadius: radius.sm },
  bar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  submit: { minHeight: 52 },
});
