import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Chip, IconButton, Text, TextInput } from 'react-native-paper';

import { repositories } from '@/db';
import { useIngredientsMap, useShoppingItems } from '@/db/hooks';
import type { ShoppingItem } from '@/db/schema';
import { searchIngredients } from '@/domain/search';
import { showUndo } from '@/features/undo/undoStore';
import { formatAmount } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { SwipeToDelete } from '@/ui/SwipeToDelete';

export function ShoppingSegment() {
  const theme = useAppTheme();
  const items = useShoppingItems();
  const ingredients = useIngredientsMap();
  const [text, setText] = useState('');

  const open = items.filter((i) => !i.checked);
  const bought = items.filter((i) => i.checked);
  const suggestions = useMemo(
    () =>
      text.trim().length < 2
        ? []
        : searchIngredients(
            [...ingredients.values()].filter((i) => !i.isStaple),
            text,
          ).slice(0, 4),
    [ingredients, text],
  );

  const addFree = () => {
    const title = text.trim();
    if (!title) return;
    repositories.shopping.add({ title, ingredientId: null, quantity: null, unit: null });
    setText('');
  };

  const toggle = (item: ShoppingItem) => {
    repositories.shopping.setChecked(item.id, !item.checked);
    if (!item.checked && item.ingredientId) {
      const after = repositories.shopping.list().find((i) => i.id === item.id);
      const ingredient = ingredients.get(item.ingredientId);
      if (after?.addedQuantity && ingredient) {
        showUndo(
          `Домой: +${formatAmount(after.addedQuantity, ingredient.unit)} ${ingredient.name}`,
          () => repositories.shopping.setChecked(item.id, false),
        );
      }
    }
  };

  const row = (item: ShoppingItem) => {
    const amount =
      item.quantity !== null && item.unit !== null ? formatAmount(item.quantity, item.unit) : '';
    return (
      <SwipeToDelete key={item.id} onDelete={() => repositories.shopping.remove(item.id)}>
        <View style={{ backgroundColor: theme.colors.background }}>
          <Checkbox.Item
            label={amount ? `${item.title} — ${amount}` : item.title}
            status={item.checked ? 'checked' : 'unchecked'}
            onPress={() => toggle(item)}
            position="leading"
            labelStyle={[
              styles.label,
              item.checked && {
                textDecorationLine: 'line-through',
                color: theme.colors.onSurfaceVariant,
              },
            ]}
            style={styles.item}
          />
        </View>
      </SwipeToDelete>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      <View style={styles.addRow}>
        <TextInput
          mode="outlined"
          label="Добавить в список"
          accessibilityLabel="Добавить в список"
          value={text}
          onChangeText={setText}
          onSubmitEditing={addFree}
          returnKeyType="done"
          style={styles.flex}
          dense
        />
        <IconButton
          icon="plus"
          mode="contained"
          onPress={addFree}
          disabled={!text.trim()}
          accessibilityLabel="Добавить"
        />
      </View>
      {suggestions.length > 0 ? (
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Chip
              key={s.id}
              icon="plus"
              onPress={() => {
                repositories.shopping.add({
                  title: s.name,
                  ingredientId: s.id,
                  quantity: null,
                  unit: null,
                });
                setText('');
              }}>
              {s.name}
            </Chip>
          ))}
        </View>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Список покупок пуст"
          description="Добавляй вручную или кнопкой «Добавить недостающее» в карточке блюда."
        />
      ) : null}

      {open.map(row)}

      {bought.length > 0 ? (
        <>
          <View style={styles.boughtHeader}>
            <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Куплено · добавлено домой
            </Text>
            <Button compact onPress={() => repositories.shopping.clearChecked()}>
              Очистить
            </Button>
          </View>
          {bought.map(row)}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.xs, paddingBottom: spacing.xxl },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  item: { paddingHorizontal: 0, minHeight: 48 },
  label: { textAlign: 'left' },
  boughtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});
