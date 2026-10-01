import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, Surface, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIngredientsMap, useLidlProducts, usePantryItems } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import { defaultAddAmount, smallestPackages } from '@/domain/bulkAdd';
import { normalizeForSearch, searchIngredients } from '@/domain/search';
import { INGREDIENT_IMAGES } from '@/features/images';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { useBulkAddStore } from '@/features/pantry/bulkAddStore';
import { NewProductForm } from '@/features/pantry/NewProductForm';
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

/** «Добавить домой»: search with multi-select; the selection survives new queries. */
export default function BulkSelectScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const ingredients = useIngredientsMap();
  const pantry = usePantryItems();
  const lidl = useLidlProducts();
  const selected = useBulkAddStore((s) => s.selected);
  const toggle = useBulkAddStore((s) => s.toggle);
  const select = useBulkAddStore((s) => s.select);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const packages = useMemo(() => smallestPackages(lidl), [lidl]);
  const stock = useMemo(() => new Map(pantry.map((p) => [p.ingredientId, p.quantity])), [pantry]);
  const results = useMemo(
    () =>
      searchIngredients(
        [...ingredients.values()].filter((i) => !i.isStaple),
        query,
      ),
    [ingredients, query],
  );
  const exact = results.some((i) => normalizeForSearch(i.name) === normalizeForSearch(query));
  const defaultFor = (i: Ingredient) => defaultAddAmount(i, packages.get(i.id), i.lastAddedAmount);
  const selectedSet = new Set(selected);

  return (
    <View style={styles.flex}>
      <View style={styles.search}>
        <TextInput
          mode="outlined"
          label="Поиск: творог, túró…"
          accessibilityLabel="Поиск продукта"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setCreating(false);
          }}
          left={<TextInput.Icon icon="magnify" />}
          autoCorrect={false}
        />
      </View>
      <FlashList
        data={results}
        keyExtractor={(i) => i.id}
        extraData={selected}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          query.trim() && !exact ? (
            <View style={styles.create}>
              {creating ? (
                <NewProductForm
                  initialName={query.trim()}
                  onCancel={() => setCreating(false)}
                  onCreated={(i) => {
                    select(i.id, defaultFor(i));
                    setCreating(false);
                    setQuery('');
                  }}
                />
              ) : (
                <Button mode="outlined" icon="plus" onPress={() => setCreating(true)}>
                  {`Новый продукт «${query.trim()}»`}
                </Button>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const checked = selectedSet.has(item.id);
          const have = stock.get(item.id);
          return (
            <TouchableRipple
              onPress={() => toggle(item.id, defaultFor(item))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={item.name}>
              <View style={styles.row}>
                <Checkbox status={checked ? 'checked' : 'unchecked'} />
                <ImageWithFallback
                  source={item.imageKey ? INGREDIENT_IMAGES[item.imageKey] : undefined}
                  fallbackIcon={CATEGORY_ICONS[item.category]}
                  style={styles.image}
                  iconSize={20}
                />
                <View style={styles.flex}>
                  <Text variant="bodyLarge">{item.name}</Text>
                  {have !== undefined ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      дома: {formatAmount(have, item.unit)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </TouchableRipple>
          );
        }}
      />
      <Surface elevation={2} style={[styles.bar, { paddingBottom: spacing.md + insets.bottom }]}>
        <Text variant="titleMedium" style={styles.flex} accessibilityLiveRegion="polite">
          Выбрано: {selected.length}
        </Text>
        <Button
          mode="contained"
          icon="arrow-right"
          contentStyle={styles.next}
          disabled={selected.length === 0}
          onPress={() => router.push('/bulk-add/amounts')}>
          Далее
        </Button>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  list: { paddingBottom: spacing.lg },
  create: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  image: { width: 36, height: 36, borderRadius: radius.sm },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  next: { flexDirection: 'row-reverse', minHeight: 48 },
});
