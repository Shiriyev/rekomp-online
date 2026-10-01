import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Surface, Text } from 'react-native-paper';

import { repositories } from '@/db';
import { useIngredientsMap, useLidlProducts, usePantryItems, useShoppingItems } from '@/db/hooks';
import type { LidlProduct, ShoppingItem } from '@/db/schema';
import { defaultAddAmount } from '@/domain/bulkAdd';
import { shoppingStep, stepQuantity } from '@/domain/stock';
import { convertAmount } from '@/domain/units';
import { showUndo } from '@/features/undo/undoStore';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { QuantityStepper } from '@/ui/QuantityStepper';
import { SwipeToDelete } from '@/ui/SwipeToDelete';

import { useBulkAddStore } from './bulkAddStore';
import { ProductPickerSheet } from './ProductPickerSheet';

export function ShoppingSegment() {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const items = useShoppingItems();
  const ingredients = useIngredientsMap();
  const pantry = usePantryItems();
  const lidl = useLidlProducts();
  const pickerRef = useRef<BottomSheetModal>(null);
  // «Купил несколько»: pick bought items, then set the amounts on one screen.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  // Smallest Lidl package per ingredient: default amount and +/- step.
  const packageOf = useMemo(() => {
    const map = new Map<string, LidlProduct>();
    for (const p of lidl) {
      const current = map.get(p.ingredientId);
      if (!current || p.packageSize < current.packageSize) map.set(p.ingredientId, p);
    }
    return map;
  }, [lidl]);

  const open = items.filter((i) => !i.checked);
  const bought = items.filter((i) => i.checked);
  const linkedOpen = open.filter((i) => i.ingredientId && ingredients.has(i.ingredientId));

  // Catalog-linked items follow the language; free-text items stay as typed.
  const titleOf = (item: ShoppingItem) => {
    const ingredient = item.ingredientId ? ingredients.get(item.ingredientId) : undefined;
    return ingredient ? content.ingredientName(ingredient) : item.title;
  };

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const continueToAmounts = () => {
    const store = useBulkAddStore.getState();
    store.start('shopping');
    for (const item of linkedOpen) {
      if (!picked.has(item.id) || !item.ingredientId) continue;
      const ingredient = ingredients.get(item.ingredientId)!;
      // What the list says to buy, else one package / the last amount.
      const amount =
        item.quantity !== null && item.unit !== null
          ? convertAmount(item.quantity, item.unit, ingredient.unit, ingredient)
          : defaultAddAmount(ingredient, packageOf.get(ingredient.id), ingredient.lastAddedAmount);
      store.toggle(ingredient.id, amount, item.id);
    }
    setSelecting(false);
    setPicked(new Set());
    router.push('/bulk-add/amounts');
  };

  const toggle = (item: ShoppingItem) => {
    repositories.shopping.setChecked(item.id, !item.checked);
    if (!item.checked && item.ingredientId) {
      const after = repositories.shopping.list().find((i) => i.id === item.id);
      const ingredient = ingredients.get(item.ingredientId);
      if (after?.addedQuantity && ingredient) {
        showUndo(
          t('pantry.shopping.homeAdded', {
            amount: formatAmount(after.addedQuantity, ingredient.unit),
            name: content.ingredientName(ingredient),
          }),
          () => repositories.shopping.setChecked(item.id, false),
        );
      }
    }
  };

  const pickRow = (item: ShoppingItem) => {
    const linked = !!item.ingredientId && ingredients.has(item.ingredientId);
    const amount =
      item.quantity !== null && item.unit !== null ? formatAmount(item.quantity, item.unit) : '';
    const title = titleOf(item);
    return (
      <Checkbox.Item
        key={item.id}
        label={amount ? `${title} — ${amount}` : title}
        status={picked.has(item.id) ? 'checked' : 'unchecked'}
        onPress={() => togglePick(item.id)}
        disabled={!linked}
        position="leading"
        labelStyle={styles.label}
        style={styles.item}
      />
    );
  };

  const row = (item: ShoppingItem) => {
    const ingredient = item.ingredientId ? ingredients.get(item.ingredientId) : undefined;
    const canEdit = !item.checked && ingredient && item.quantity !== null && item.unit !== null;
    const step = ingredient ? shoppingStep(ingredient, packageOf.get(ingredient.id)) : 1;
    const amount =
      item.quantity !== null && item.unit !== null ? formatAmount(item.quantity, item.unit) : '';
    const title = titleOf(item);

    return (
      <SwipeToDelete key={item.id} onDelete={() => repositories.shopping.remove(item.id)}>
        <View style={[styles.row, { backgroundColor: theme.colors.background }]}>
          <View style={styles.flex}>
            <Checkbox.Item
              label={canEdit || !amount ? title : `${title} — ${amount}`}
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
          {canEdit ? (
            <QuantityStepper
              label={title}
              valueText={amount}
              decrementDisabled={(item.quantity ?? 0) <= step}
              onDecrement={() =>
                repositories.shopping.setQuantity(
                  item.id,
                  stepQuantity(item.quantity ?? step, step, -1),
                )
              }
              onIncrement={() =>
                repositories.shopping.setQuantity(
                  item.id,
                  stepQuantity(item.quantity ?? 0, step, 1),
                )
              }
            />
          ) : null}
        </View>
      </SwipeToDelete>
    );
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.toolbar}>
          {selecting ? (
            <Text
              variant="bodyMedium"
              style={[styles.flex, { color: theme.colors.onSurfaceVariant }]}>
              {t('pantry.shopping.selectHint')}
            </Text>
          ) : (
            <Button mode="contained-tonal" icon="plus" onPress={() => pickerRef.current?.present()}>
              {t('pantry.shopping.addProduct')}
            </Button>
          )}
          {linkedOpen.length > 1 || selecting ? (
            <Button
              icon={selecting ? 'close' : 'checkbox-multiple-marked-outline'}
              onPress={() => {
                setSelecting((s) => !s);
                setPicked(new Set());
              }}>
              {selecting ? t('common.actions.cancel') : t('pantry.shopping.boughtSeveral')}
            </Button>
          ) : null}
        </View>

        {items.length === 0 ? (
          <EmptyState
            icon="cart-outline"
            title={t('pantry.shopping.emptyTitle')}
            description={t('pantry.shopping.emptyDescription')}
          />
        ) : null}

        {selecting ? open.map(pickRow) : open.map(row)}

        {bought.length > 0 && !selecting ? (
          <>
            <View style={styles.boughtHeader}>
              <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('pantry.shopping.boughtHeader')}
              </Text>
              <Button compact onPress={() => repositories.shopping.clearChecked()}>
                {t('pantry.shopping.clear')}
              </Button>
            </View>
            {bought.map(row)}
          </>
        ) : null}
      </ScrollView>

      {selecting ? (
        <Surface elevation={2} style={styles.bar}>
          <Text variant="titleMedium" style={styles.flex} accessibilityLiveRegion="polite">
            {t('pantry.shopping.selected', { n: picked.size })}
          </Text>
          <Button
            mode="contained"
            icon="arrow-right"
            contentStyle={styles.next}
            disabled={picked.size === 0}
            onPress={continueToAmounts}>
            {t('common.actions.next')}
          </Button>
        </Surface>
      ) : null}

      <ProductPickerSheet
        sheetRef={pickerRef}
        ingredients={[...ingredients.values()]}
        title={t('pantry.shopping.pickerTitle')}
        amountHint={t('pantry.shopping.pickerHint')}
        submitLabel={t('pantry.shopping.pickerSubmit')}
        describe={(i) => {
          const have = pantry.find((p) => p.ingredientId === i.id);
          const listed = open.some((o) => o.ingredientId === i.id);
          return (
            [
              have
                ? t('pantry.shopping.atHome', { amount: formatAmount(have.quantity, i.unit) })
                : null,
              listed ? t('pantry.shopping.alreadyListed') : null,
            ]
              .filter(Boolean)
              .join(' · ') || null
          );
        }}
        defaultAmount={(i) => shoppingStep(i, packageOf.get(i.id))}
        onSubmit={(ingredient, amount) => {
          repositories.shopping.add({
            title: ingredient.name,
            ingredientId: ingredient.id,
            quantity: amount,
            unit: ingredient.unit,
          });
          showUndo(
            t('pantry.shopping.added', {
              name: content.ingredientName(ingredient),
              amount: formatAmount(amount, ingredient.unit),
            }),
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.xs, paddingBottom: spacing.xxl },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  next: { flexDirection: 'row-reverse', minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { paddingHorizontal: 0, minHeight: 48 },
  label: { textAlign: 'left' },
  boughtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});
