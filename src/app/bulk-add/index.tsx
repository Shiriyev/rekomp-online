import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Surface, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIngredientsMap, useLidlProducts, usePantryItems } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import { defaultAddAmount, smallestPackages } from '@/domain/bulkAdd';
import { searchIngredients, suggestSimilar } from '@/domain/search';
import { INGREDIENT_CATEGORIES, type IngredientCategory } from '@/domain/types';
import { bundledImage } from '@/features/bundledImage';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/features/ingredients';
import { useBulkAddStore } from '@/features/pantry/bulkAddStore';
import { NotInCatalog } from '@/features/pantry/NotInCatalog';
import { sortProducts, useProductPopularity, useProductSort } from '@/features/pantry/productSort';
import { ProductSortChip } from '@/features/pantry/ProductSortChip';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

/** Category chip, or the products already ticked. */
type Filter = 'all' | 'selected' | IngredientCategory;

/**
 * «Добавить домой»: the catalog as a three-column photo grid with search and category
 * chips; tap tiles to pick several products, the selection survives new searches.
 */
export default function BulkSelectScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const content = useContent();
  const ingredients = useIngredientsMap();
  const pantry = usePantryItems();
  const lidl = useLidlProducts();
  const selected = useBulkAddStore((s) => s.selected);
  const toggle = useBulkAddStore((s) => s.toggle);
  const select = useBulkAddStore((s) => s.select);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const packages = useMemo(() => smallestPackages(lidl), [lidl]);
  const stock = useMemo(() => new Map(pantry.map((p) => [p.ingredientId, p.quantity])), [pantry]);
  const sort = useProductSort((x) => x.sort);
  const popularity = useProductPopularity();
  const available = useMemo(
    () =>
      sortProducts(
        [...ingredients.values()]
          .filter((i) => !i.isStaple && !i.isArchived)
          .map((i) => ({ ...i, aliases: content.searchAliases(i) })),
        sort,
        (i) => ({ id: i.id, category: i.category, name: content.ingredientName(i) }),
        popularity,
      ),
    [ingredients, content, sort, popularity],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const counts = useMemo(() => {
    const map = new Map<IngredientCategory, number>();
    for (const i of available) map.set(i.category, (map.get(i.category) ?? 0) + 1);
    return map;
  }, [available]);

  const results = useMemo(() => {
    const inFilter =
      filter === 'all'
        ? available
        : filter === 'selected'
          ? available.filter((i) => selectedSet.has(i.id))
          : available.filter((i) => i.category === filter);
    return searchIngredients(inFilter, query);
  }, [available, filter, selectedSet, query]);
  // Products come only from the catalog: nothing found → look-alikes, never a new product.
  const suggestions = useMemo(
    () => (results.length === 0 && query.trim() ? suggestSimilar(available, query) : []),
    [available, query, results.length],
  );
  const defaultFor = (i: Ingredient) => defaultAddAmount(i, packages.get(i.id), i.lastAddedAmount);

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: t('pantry.home.all') },
    ...(selected.length > 0
      ? [{ id: 'selected' as const, label: t('bulkAdd.selected', { count: selected.length }) }]
      : []),
    ...INGREDIENT_CATEGORIES.flatMap((c) =>
      counts.get(c) ? [{ id: c, label: `${CATEGORY_LABELS[c]} · ${counts.get(c)}` }] : [],
    ),
  ];

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: t('bulkAdd.selectTitle') }} />
      <View style={styles.search}>
        <TextInput
          mode="outlined"
          dense
          placeholder={t('bulkAdd.search')}
          accessibilityLabel={t('bulkAdd.searchLabel')}
          value={query}
          onChangeText={setQuery}
          left={<TextInput.Icon icon="magnify" />}
          right={query ? <TextInput.Icon icon="close" onPress={() => setQuery('')} /> : undefined}
          autoCorrect={false}
        />
      </View>
      <View>
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
              icon={c.id === 'all' || c.id === 'selected' ? undefined : CATEGORY_ICONS[c.id]}
              onPress={() => setFilter(c.id)}>
              {c.label}
            </Chip>
          ))}
        </ScrollView>
      </View>
      <FlashList
        data={results}
        numColumns={3}
        keyExtractor={(i) => i.id}
        extraData={selectedSet}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          query.trim() ? (
            <NotInCatalog
              suggestions={suggestions}
              onPick={(i) => {
                select(i.id, defaultFor(i));
                setQuery('');
              }}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <SelectTile
              ingredient={item}
              checked={selectedSet.has(item.id)}
              have={stock.get(item.id)}
              onToggle={() => toggle(item.id, defaultFor(item))}
            />
          </View>
        )}
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
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
