import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, FAB, IconButton, Text, TextInput } from 'react-native-paper';

import { repositories } from '@/db';
import { useIngredientsMap, usePantryItems } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import { searchIngredients } from '@/domain/search';
import { isLowStock } from '@/domain/stock';
import { INGREDIENT_CATEGORIES, type IngredientCategory } from '@/domain/types';
import { quantityStep } from '@/domain/units';
import { bundledImage } from '@/features/bundledImage';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/features/ingredients';
import { showUndo } from '@/features/undo/undoStore';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

import { useBulkAddStore } from './bulkAddStore';
import { PantryItemSheet, type PantryItemSheetHandle } from './PantryItemSheet';
import { sortProducts, useProductPopularity, useProductSort } from './productSort';
import { ProductSortChip } from './ProductSortChip';

type Stock = { ingredient: Ingredient; quantity: number; low: boolean };
/** Chip above the grid: everything, what runs out, or one category. */
type Filter = 'all' | 'low' | IngredientCategory;

/**
 * «Дома»: everything at home as a two-column grid of photo tiles, with search and chips
 * (all, running low, each category with its count) so a long list stays readable.
 */
export function HomeSegment() {
  const t = useT();
  const content = useContent();
  const items = usePantryItems();
  const ingredients = useIngredientsMap();
  const editRef = useRef<PantryItemSheetHandle>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const sort = useProductSort((x) => x.sort);
  const popularity = useProductPopularity();
  const stock = useMemo<Stock[]>(() => {
    const rows = items.flatMap((p) => {
      const ingredient = ingredients.get(p.ingredientId);
      if (!ingredient) return [];
      const low = isLowStock(p.quantity, ingredient.unit, ingredient.lowStockThreshold);
      return [{ ingredient, quantity: p.quantity, low }];
    });
    return sortProducts(
      rows,
      sort,
      (r) => ({
        id: r.ingredient.id,
        category: r.ingredient.category,
        name: content.ingredientName(r.ingredient),
      }),
      popularity,
    );
  }, [items, ingredients, content, sort, popularity]);

  const counts = useMemo(() => {
    const byCategory = new Map<IngredientCategory, number>();
    for (const s of stock)
      byCategory.set(s.ingredient.category, (byCategory.get(s.ingredient.category) ?? 0) + 1);
    return { byCategory, low: stock.filter((s) => s.low).length };
  }, [stock]);

  const shown = useMemo(() => {
    const inFilter = stock.filter((s) =>
      filter === 'all' ? true : filter === 'low' ? s.low : s.ingredient.category === filter,
    );
    if (!query.trim()) return inFilter;
    const named = inFilter.map((s) => ({
      ...s,
      name: s.ingredient.name,
      nameHu: s.ingredient.nameHu,
      aliases: content.searchAliases(s.ingredient),
    }));
    return searchIngredients(named, query);
  }, [stock, filter, query, content]);

  const openBulkAdd = () => {
    useBulkAddStore.getState().start('home');
    router.push('/bulk-add');
  };

  const remove = useCallback(
    (ingredient: Ingredient, quantity: number) => {
      repositories.pantry.remove(ingredient.id);
      showUndo(t('pantry.home.removed', { name: content.ingredientName(ingredient) }), () =>
        repositories.pantry.setQuantity(ingredient.id, quantity),
      );
    },
    [t, content],
  );
  const openItem = useCallback(
    (ingredient: Ingredient, quantity: number) => editRef.current?.open(ingredient, quantity),
    [],
  );

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: t('pantry.home.all'), count: stock.length },
    ...(counts.low > 0
      ? [{ id: 'low' as const, label: t('pantry.home.low'), count: counts.low }]
      : []),
    ...INGREDIENT_CATEGORIES.flatMap((c) => {
      const n = counts.byCategory.get(c) ?? 0;
      return n > 0 ? [{ id: c, label: CATEGORY_LABELS[c], count: n }] : [];
    }),
  ];

  return (
    <View style={styles.flex}>
      {stock.length === 0 ? (
        <EmptyState
          icon="fridge-outline"
          title={t('pantry.home.emptyTitle')}
          description={t('pantry.home.emptyDescription')}
          actionLabel={t('pantry.home.emptyAction')}
          onAction={openBulkAdd}
        />
      ) : (
        <FlashList
          data={shown}
          numColumns={2}
          keyExtractor={(s) => s.ingredient.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.grid}
          ListHeaderComponent={
            <View>
              <View style={styles.search}>
                <TextInput
                  mode="outlined"
                  dense
                  placeholder={t('pantry.home.search')}
                  accessibilityLabel={t('pantry.home.search')}
                  value={query}
                  onChangeText={setQuery}
                  left={<TextInput.Icon icon="magnify" />}
                  right={
                    query ? <TextInput.Icon icon="close" onPress={() => setQuery('')} /> : undefined
                  }
                  autoCorrect={false}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
                keyboardShouldPersistTaps="handled">
                <ProductSortChip />
                {chips.map((c) => (
                  <Chip
                    key={c.id}
                    compact
                    mode={filter === c.id ? 'flat' : 'outlined'}
                    selected={filter === c.id}
                    showSelectedCheck={false}
                    icon={c.id === 'low' ? 'alert-outline' : undefined}
                    onPress={() => setFilter(c.id)}>
                    {`${c.label} · ${c.count}`}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="magnify-close" title={t('pantry.home.nothingFound')} />
          }
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <PantryTile
                ingredient={item.ingredient}
                quantity={item.quantity}
                low={item.low}
                onOpen={openItem}
              />
            </View>
          )}
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

type TileProps = {
  ingredient: Ingredient;
  quantity: number;
  low: boolean;
  onOpen: (ingredient: Ingredient, quantity: number) => void;
};

/** One product at home: photo, name, amount and −/+. Memoized: a «+» redraws one tile. */
const PantryTile = memo(function PantryTile({ ingredient, quantity, low, onOpen }: TileProps) {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const name = content.ingredientName(ingredient);
  const step = quantityStep(ingredient.unit);
  return (
    <Card
      mode="contained"
      style={styles.tile}
      onPress={() => onOpen(ingredient, quantity)}
      accessibilityLabel={`${name}, ${formatAmount(quantity, ingredient.unit)}`}
      accessibilityHint={t('pantry.home.editHint')}>
      <ImageWithFallback
        source={bundledImage(ingredient.imageKey)}
        fallbackIcon={CATEGORY_ICONS[ingredient.category]}
        style={styles.image}
        iconSize={32}
      />
      <View style={styles.body}>
        <Text variant="titleSmall" numberOfLines={2} style={styles.name}>
          {name}
        </Text>
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={{ color: low ? theme.colors.warning : theme.colors.onSurfaceVariant }}>
          {low
            ? quantity === 0
              ? t('pantry.home.outOfStock')
              : t('pantry.home.lowStock')
            : CATEGORY_LABELS[ingredient.category]}
        </Text>
        <View style={styles.stepper}>
          <IconButton
            icon="minus"
            size={18}
            mode="outlined"
            disabled={quantity <= 0}
            onPress={() => repositories.pantry.adjust(ingredient.id, -step)}
            accessibilityLabel={t('ui.stepper.decrement', { label: name })}
            style={styles.button}
          />
          <Text variant="titleSmall" style={styles.amount} numberOfLines={1}>
            {formatAmount(quantity, ingredient.unit)}
          </Text>
          <IconButton
            icon="plus"
            size={18}
            mode="outlined"
            onPress={() => repositories.pantry.adjust(ingredient.id, step)}
            accessibilityLabel={t('ui.stepper.increment', { label: name })}
            style={styles.button}
          />
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { paddingHorizontal: spacing.md, paddingBottom: 96 },
  search: { paddingHorizontal: spacing.xs, paddingTop: spacing.md },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  cell: { flex: 1, padding: spacing.xs },
  tile: { overflow: 'hidden', borderRadius: radius.md },
  image: { width: '100%', aspectRatio: 16 / 10 },
  body: { padding: spacing.sm, gap: 2 },
  name: { minHeight: 40 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { margin: 0 },
  amount: { flex: 1, textAlign: 'center' },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
});
