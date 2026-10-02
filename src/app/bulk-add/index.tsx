import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, Surface, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIngredientsMap, useLidlProducts, usePantryItems } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import { defaultAddAmount, smallestPackages } from '@/domain/bulkAdd';
import { normalizeForSearch, searchIngredients } from '@/domain/search';
import { bundledImage } from '@/features/bundledImage';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { useBulkAddStore } from '@/features/pantry/bulkAddStore';
import { NewProductForm } from '@/features/pantry/NewProductForm';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

/** «Добавить домой»: search with multi-select; the selection survives new queries. */
export default function BulkSelectScreen() {
  const theme = useAppTheme();
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
  const [creating, setCreating] = useState(false);

  const packages = useMemo(() => smallestPackages(lidl), [lidl]);
  const stock = useMemo(() => new Map(pantry.map((p) => [p.ingredientId, p.quantity])), [pantry]);
  const results = useMemo(
    () =>
      searchIngredients(
        [...ingredients.values()]
          .filter((i) => !i.isStaple && !i.isArchived)
          .map((i) => ({ ...i, aliases: content.searchAliases(i) })),
        query,
      ),
    [ingredients, query, content],
  );
  const exact = results.some((i) => normalizeForSearch(i.name) === normalizeForSearch(query));
  const defaultFor = (i: Ingredient) => defaultAddAmount(i, packages.get(i.id), i.lastAddedAmount);
  const selectedSet = new Set(selected);

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: t('bulkAdd.selectTitle') }} />
      <View style={styles.search}>
        <TextInput
          mode="outlined"
          label={t('bulkAdd.search')}
          accessibilityLabel={t('bulkAdd.searchLabel')}
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
                  {t('bulkAdd.newProduct', { name: query.trim() })}
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
              accessibilityLabel={content.ingredientName(item)}>
              <View style={styles.row}>
                <Checkbox status={checked ? 'checked' : 'unchecked'} />
                <ImageWithFallback
                  source={bundledImage(item.imageKey)}
                  fallbackIcon={CATEGORY_ICONS[item.category]}
                  style={styles.image}
                  iconSize={20}
                />
                <View style={styles.flex}>
                  <Text variant="bodyLarge">{content.ingredientName(item)}</Text>
                  {have !== undefined ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t('bulkAdd.atHome', { amount: formatAmount(have, item.unit) })}
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
