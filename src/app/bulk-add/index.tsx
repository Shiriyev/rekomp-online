import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Surface, Text, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIngredientsMap, usePantryItems } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import { defaultAddAmount } from '@/domain/bulkAdd';
import { bundledImage } from '@/features/bundledImage';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { useBulkAddStore } from '@/features/pantry/bulkAddStore';
import { openProductCard, ProductRow } from '@/features/products/ProductRow';
import { ProductsEmpty } from '@/features/products/ProductsEmpty';
import { ProductToolbar } from '@/features/products/ProductToolbar';
import { useProductBrowser } from '@/features/products/useProductBrowser';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

/**
 * «Добавить домой»: the catalog as a three-column photo grid (or a list) with search,
 * category chips and filters; tap to pick several products, the selection survives new
 * searches. Long-press opens the product card.
 */
export default function BulkSelectScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const ingredients = useIngredientsMap();
  const pantry = usePantryItems();
  const selected = useBulkAddStore((s) => s.selected);
  const toggle = useBulkAddStore((s) => s.toggle);
  const [onlySelected, setOnlySelected] = useState(false);

  const stock = useMemo(() => new Map(pantry.map((p) => [p.ingredientId, p.quantity])), [pantry]);
  const available = useMemo(
    // Broth and the like are never kept at home (not tracked).
    () => [...ingredients.values()].filter((i) => !i.isStaple && !i.isArchived && i.stockTracked),
    [ingredients],
  );
  const browser = useProductBrowser('add', available, stock);
  const { state, results, similar } = browser;
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const shown = useMemo(
    () => (onlySelected ? results.filter((i) => selectedSet.has(i.id)) : results),
    [results, onlySelected, selectedSet],
  );
  const defaultFor = (i: Ingredient) => defaultAddAmount(i, i.lastAddedAmount);
  const grid = state.view === 'grid';

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: t('bulkAdd.selectTitle') }} />
      <ProductToolbar
        browser={browser}
        screen="add"
        extraChips={
          selected.length > 0 || onlySelected ? (
            <Chip
              compact
              icon="check"
              mode={onlySelected ? 'flat' : 'outlined'}
              selected={onlySelected}
              showSelectedCheck={false}
              onPress={() => setOnlySelected((v) => !v)}>
              {t('bulkAdd.selected', { count: selected.length })}
            </Chip>
          ) : null
        }
      />
      {similar && shown.length > 0 ? (
        <Text variant="labelLarge" style={styles.similar}>
          {t('products.similar')}
        </Text>
      ) : null}
      <FlashList
        key={state.view}
        data={shown}
        numColumns={grid ? 3 : 1}
        keyExtractor={(i) => i.id}
        extraData={selectedSet}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={grid ? styles.grid : styles.list}
        ListEmptyComponent={
          <ProductsEmpty browser={browser} onReset={() => setOnlySelected(false)} />
        }
        renderItem={({ item }) =>
          grid ? (
            <View style={styles.cell}>
              <SelectTile
                ingredient={item}
                checked={selectedSet.has(item.id)}
                have={stock.get(item.id)}
                onToggle={() => toggle(item.id, defaultFor(item))}
              />
            </View>
          ) : (
            <SelectRow
              ingredient={item}
              checked={selectedSet.has(item.id)}
              have={stock.get(item.id)}
              onToggle={() => toggle(item.id, defaultFor(item))}
            />
          )
        }
      />
      <Surface elevation={2} style={[styles.bar, { paddingBottom: spacing.md + insets.bottom }]}>
        <Text variant="titleMedium" style={styles.flex} accessibilityLiveRegion="polite">
          {t('bulkAdd.selected', { count: selected.length })}
        </Text>
        <Button
          mode="contained"
          icon="arrow-right"
          contentStyle={styles.next}
          disabled={selected.length === 0}
          onPress={() => router.push('/bulk-add/amounts')}>
          {t('bulkAdd.next')}
        </Button>
      </Surface>
    </View>
  );
}

type TileProps = {
  ingredient: Ingredient;
  checked: boolean;
  /** Amount already at home, if any. */
  have: number | undefined;
  onToggle: () => void;
};

/** A product to tick: square photo with a check mark, name and what is at home. */
const SelectTile = memo(function SelectTile({ ingredient, checked, have, onToggle }: TileProps) {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const name = content.ingredientName(ingredient);
  return (
    <TouchableRipple
      onPress={onToggle}
      onLongPress={() => openProductCard(ingredient.id)}
      borderless
      style={[
        styles.tile,
        {
          borderColor: checked ? theme.colors.primary : 'transparent',
          backgroundColor: theme.colors.surfaceVariant,
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={name}>
      <View>
        <ImageWithFallback
          source={bundledImage(ingredient.imageKey)}
          fallbackIcon={CATEGORY_ICONS[ingredient.category]}
          style={styles.image}
          iconSize={28}
        />
        {checked ? (
          <View style={[styles.check, { backgroundColor: theme.colors.primary }]}>
            <MaterialCommunityIcons name="check" size={18} color={theme.colors.onPrimary} />
          </View>
        ) : null}
        <View style={styles.tileBody}>
          <Text variant="labelLarge" numberOfLines={2} style={styles.name}>
            {name}
          </Text>
          <Text
            variant="labelSmall"
            numberOfLines={1}
            style={{ color: theme.colors.onSurfaceVariant }}>
            {have !== undefined
              ? t('bulkAdd.atHome', { amount: formatAmount(have, ingredient.unit) })
              : ' '}
          </Text>
        </View>
      </View>
    </TouchableRipple>
  );
});

/** List view: the shared product row with what is at home and a check box. */
const SelectRow = memo(function SelectRow({ ingredient, checked, have, onToggle }: TileProps) {
  const theme = useAppTheme();
  const t = useT();
  return (
    <ProductRow
      ingredient={ingredient}
      onPress={onToggle}
      selected={checked}
      accessibilityRole="checkbox"
      subtitle={
        have !== undefined
          ? t('bulkAdd.atHome', { amount: formatAmount(have, ingredient.unit) })
          : undefined
      }
      trailing={
        <MaterialCommunityIcons
          name={checked ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
          size={24}
          color={checked ? theme.colors.primary : theme.colors.onSurfaceVariant}
        />
      }
    />
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.lg },
  similar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  cell: { flex: 1, padding: spacing.xs },
  tile: { borderRadius: radius.md, borderWidth: 2, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1 },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: { padding: spacing.xs, gap: 1 },
  // Two lines reserved so tiles in a row line up.
  name: { minHeight: 36 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  next: { flexDirection: 'row-reverse', minHeight: 48 },
});
