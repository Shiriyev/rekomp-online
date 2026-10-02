import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
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
import { bundledImage } from '@/features/bundledImage';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { useBulkAddStore } from '@/features/pantry/bulkAddStore';
import { showUndo } from '@/features/undo/undoStore';
import { t as translate, translateMessage, useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { AmountInput } from '@/ui/AmountInput';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';
import { SwipeToDelete } from '@/ui/SwipeToDelete';

/** «Количество»: one card per picked product, then everything in one transaction. */
export default function BulkAmountsScreen() {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
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
        showUndo(translate('bulkAdd.bought', { count: ids.length }), () =>
          repositories.shopping.uncheckMany(ids),
        );
      } else {
        const result = repositories.pantry.addMany(
          rows.map((i) => ({ ingredientId: i.id, amount: amounts[i.id] ?? 0 })),
        );
        showUndo(translate('bulkAdd.added', { count: result.items.length }), () =>
          repositories.pantry.undoAddMany(result),
        );
      }
      clear();
      router.dismissTo('/pantry');
    } catch (e) {
      showUndo(
        translate('bulkAdd.failed', {
          reason:
            e instanceof Error ? translateMessage(e.message) : translate('common.somethingWrong'),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="basket-outline"
        title={t('bulkAdd.nothingSelected')}
        actionLabel={t('common.actions.back')}
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
      <Stack.Screen options={{ title: t('bulkAdd.amountsTitle') }} />
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={offset}>
        <FlashList
          ref={listRef}
          data={rows}
          keyExtractor={(i) => i.id}
          extraData={amounts}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text
              variant="bodyMedium"
              style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              {t('bulkAdd.amountsHint')}
            </Text>
          }
          renderItem={({ item, index }) => {
            const amount = amounts[item.id] ?? 0;
            const have = stock.get(item.id);
            const after = afterAdding(have ?? null, amount, item.unit);
            const name = content.ingredientName(item);
            return (
              <View style={styles.cardWrap}>
                <SwipeToDelete onDelete={() => remove(item.id)} label={t('bulkAdd.swipeRemove')}>
                  <View style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
                    <View style={styles.top}>
                      <ImageWithFallback
                        source={bundledImage(item.imageKey)}
                        fallbackIcon={CATEGORY_ICONS[item.category]}
                        style={styles.image}
                        iconSize={24}
                      />
                      <View style={styles.flex}>
                        <Text variant="titleMedium" numberOfLines={2}>
                          {name}
                        </Text>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                          {have !== undefined
                            ? t('bulkAdd.wasBecomes', { was: formatAmount(have, item.unit) })
                            : ''}
                          <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
                            {t('bulkAdd.becomes', { amount: formatAmount(after, item.unit) })}
                          </Text>
                        </Text>
                      </View>
                      <IconButton
                        icon="close"
                        size={20}
                        onPress={() => remove(item.id)}
                        accessibilityLabel={t('bulkAdd.removeFromBatch', { name })}
                      />
                    </View>
                    <View style={styles.stepper}>
                      <AmountInput
                        label={name}
                        value={amount}
                        onChange={(n) => setAmount(item.id, n)}
                        unit={item.unit}
                        step={bulkStep(item.unit)}
                        inputRef={(r) => {
                          inputs.current.set(index, r);
                        }}
                        returnKeyType={index < rows.length - 1 ? 'next' : 'done'}
                        onSubmitEditing={
                          index < rows.length - 1 ? () => focusNext(index) : undefined
                        }
                      />
                    </View>
                  </View>
                </SwipeToDelete>
              </View>
            );
          }}
        />
        <Surface elevation={2} style={[styles.bar, { paddingBottom: spacing.md + insets.bottom }]}>
          <Button
            mode="contained"
            icon="check"
            onPress={addAll}
            disabled={saving || invalid}
            contentStyle={styles.submit}
            labelStyle={styles.submitLabel}>
            {source === 'shopping'
              ? t('bulkAdd.boughtAddAll', { count: rows.length })
              : t('bulkAdd.addAll', { count: rows.length })}
          </Button>
        </Surface>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  hint: { paddingVertical: spacing.md },
  cardWrap: { marginBottom: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  image: { width: 56, height: 56, borderRadius: radius.md },
  stepper: { flexDirection: 'row', justifyContent: 'flex-end' },
  bar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  submit: { minHeight: 52 },
  submitLabel: { fontSize: 16 },
});
