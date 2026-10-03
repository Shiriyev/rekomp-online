import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, FAB, IconButton, Text } from 'react-native-paper';

import { repositories } from '@/db';
import { useIngredientsMap, usePantryItems } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import { quantityStep } from '@/domain/units';
import { bundledImage } from '@/features/bundledImage';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/features/ingredients';
import { openProductCard, ProductRow } from '@/features/products/ProductRow';
import { ProductsEmpty } from '@/features/products/ProductsEmpty';
import { ProductToolbar } from '@/features/products/ProductToolbar';
import { useProductBrowser } from '@/features/products/useProductBrowser';
import { showUndo } from '@/features/undo/undoStore';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

import { useBulkAddStore } from './bulkAddStore';
import { PantryItemSheet, type PantryItemSheetHandle } from './PantryItemSheet';

/**
 * «Дома»: everything at home as photo tiles or a list, with search, category and
 * subcategory chips, a filter sheet and sorts (remembered for this screen).
 */
export function HomeSegment() {
  const t = useT();
  const content = useContent();
  const items = usePantryItems();
  const ingredients = useIngredientsMap();
  const editRef = useRef<PantryItemSheetHandle>(null);

  const stock = useMemo(() => new Map(items.map((p) => [p.ingredientId, p.quantity])), [items]);
  const products = useMemo(
    () => items.flatMap((p) => ingredients.get(p.ingredientId) ?? []),
    [items, ingredients],
  );
  const browser = useProductBrowser('home', products, stock);
  const { state, update, results, factsOf, similar } = browser;
  const lowCount = useMemo(
    () => products.filter((i) => factsOf(i).low).length,
    [products, factsOf],
  );

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

  const grid = state.view === 'grid';
  const lowOn = state.stock === 'low';
  return (
    <View style={styles.flex}>
      {products.length === 0 ? (
        <EmptyState
          icon="fridge-outline"
          title={t('pantry.home.emptyTitle')}
          description={t('pantry.home.emptyDescription')}
          actionLabel={t('pantry.home.emptyAction')}
          onAction={openBulkAdd}
        />
      ) : (
        <FlashList
          // Grid and list differ in columns: a new list instead of a re-layout.
          key={state.view}
          data={results}
          numColumns={grid ? 2 : 1}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.grid}
          ListHeaderComponent={
            <ProductToolbar
              browser={browser}
              screen="home"
              inset={spacing.xs}
              extraChips={
                lowCount > 0 || lowOn ? (
                  <Chip
                    compact
                    icon="alert-outline"
                    mode={lowOn ? 'flat' : 'outlined'}
                    selected={lowOn}
                    showSelectedCheck={false}
                    onPress={() => update({ stock: lowOn ? null : 'low' })}>
                    {`${t('pantry.home.low')} · ${lowCount}`}
                  </Chip>
                ) : null
              }
            />
          }
          ListEmptyComponent={<ProductsEmpty browser={browser} />}
          renderItem={({ item, index }) => {
            const facts = factsOf(item);
            const quantity = facts.quantity ?? 0;
            return (
              <View style={grid ? styles.cell : styles.listCell}>
                {similar && index === 0 ? (
                  <Text variant="labelLarge" style={styles.similar}>
                    {t('products.similar')}
                  </Text>
                ) : null}
                {grid ? (
                  <PantryTile
                    ingredient={item}
                    quantity={quantity}
                    low={facts.low}
                    onOpen={openItem}
                  />
                ) : (
                  <PantryRow
                    ingredient={item}
                    quantity={quantity}
                    low={facts.low}
                    onOpen={openItem}
                  />
                )}
              </View>
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
      onLongPress={() => openProductCard(ingredient.id)}
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

/** List view of «Дома»: the shared product row with the amount and −/+. */
const PantryRow = memo(function PantryRow({ ingredient, quantity, low, onOpen }: TileProps) {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const name = content.ingredientName(ingredient);
  const step = quantityStep(ingredient.unit);
  return (
    <ProductRow
      ingredient={ingredient}
      onPress={() => onOpen(ingredient, quantity)}
      warning={low}
      subtitle={
        low ? (quantity === 0 ? t('pantry.home.outOfStock') : t('pantry.home.lowStock')) : undefined
      }
      trailing={
        <View style={styles.rowStepper}>
          <IconButton
            icon="minus"
            size={18}
            mode="outlined"
            disabled={quantity <= 0}
            onPress={() => repositories.pantry.adjust(ingredient.id, -step)}
            accessibilityLabel={t('ui.stepper.decrement', { label: name })}
            style={styles.button}
          />
          <Text
            variant="titleSmall"
            style={[styles.rowAmount, { color: theme.colors.onSurface }]}
            numberOfLines={1}>
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
      }
    />
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { paddingHorizontal: spacing.md, paddingBottom: 96 },
  cell: { flex: 1, padding: spacing.xs },
  listCell: { paddingVertical: 2 },
  similar: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  rowStepper: { flexDirection: 'row', alignItems: 'center' },
  rowAmount: { minWidth: 56, textAlign: 'center' },
  tile: { overflow: 'hidden', borderRadius: radius.md },
  image: { width: '100%', aspectRatio: 16 / 10 },
  body: { padding: spacing.sm, gap: 2 },
  name: { minHeight: 40 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { margin: 0 },
  amount: { flex: 1, textAlign: 'center' },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
});
