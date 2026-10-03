import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';

import { MAIN_PROTEINS } from '@/db/catalog/schema';
import {
  FILTER_GROUPS,
  KCAL_RANGE_IDS,
  MAX_INGREDIENTS,
  MAX_MINUTES,
  MIN_DENSITY,
  MIN_PROTEIN,
  RECIPE_SOURCES,
  type RecipeFilter,
  type RecipeFilterState,
} from '@/domain/browse';
import { RECIPE_SORTS } from '@/domain/recipes';
import { useT } from '@/i18n';
import { spacing } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';

import { useActiveFilterCount, useRecipeFilters, useRecipeFilterState } from './recipeFiltersStore';

/** Shown as quick chips while no filter is on: the ones people reach for most. */
const QUICK: readonly RecipeFilter[] = ['cookable', 'almost', 'no_stove', 'no_oven', 'vegetarian'];
/** «Другое» is not a useful choice in the sheet. */
const PROTEINS = MAIN_PROTEINS.filter((p) => p !== 'other');

type Props = {
  /** Recipes matching the current filters, for «Показать N блюд». */
  resultCount: number;
  /** Cuisines among this meal's recipes, most recipes first. */
  cuisines: readonly string[];
};

type T = ReturnType<typeof useT>;
type Active = { key: string; label: string; remove: () => void };

/** A cuisine name; areas the app has no name for are shown as TheMealDB writes them. */
export const cuisineLabel = (t: T, cuisine: string) =>
  t(`recipes.cuisines.${cuisine}` as 'recipes.cuisines.Thai', { defaultValue: cuisine });

/** Every active filter as a removable chip, in the sheet's order. */
function activeChips(
  t: T,
  f: RecipeFilterState,
  store: ReturnType<typeof useRecipeFilters.getState>,
): Active[] {
  const single = <
    K extends 'kcal' | 'minProtein' | 'minDensity' | 'maxMinutes' | 'maxIngredients' | 'source',
  >(
    key: K,
    label: string,
  ): Active[] =>
    f[key] === null ? [] : [{ key, label, remove: () => store.pick(key, f[key] as never) }];
  return [
    ...f.toggles.map((x) => ({
      key: x,
      label: t(`recipes.filters.${x}`),
      remove: () => store.toggle(x),
    })),
    ...single('kcal', f.kcal ? t(`recipes.filters.kcal.${f.kcal}`) : ''),
    ...single(
      'minProtein',
      `${t('recipes.browse.groups.minProtein')} ${t('recipes.filters.minProtein', { grams: f.minProtein ?? 0 })}`,
    ),
    ...single(
      'minDensity',
      `${t('recipes.browse.groups.minDensity')} ${t('recipes.filters.minDensity', { grams: f.minDensity ?? 0 })}`,
    ),
    ...single('maxMinutes', t('recipes.filters.maxMinutes', { minutes: f.maxMinutes ?? 0 })),
    ...single(
      'maxIngredients',
      `${t('recipes.browse.groups.maxIngredients')} ${t('recipes.filters.maxIngredients', { count: f.maxIngredients ?? 0 })}`,
    ),
    ...single('source', f.source ? t(`recipes.filters.source.${f.source}`) : ''),
    ...f.proteins.map((p) => ({
      key: `p:${p}`,
      label: t(`recipes.shelves.${p as (typeof PROTEINS)[number]}`),
      remove: () => store.toggleProtein(p),
    })),
    ...f.cuisines.map((c) => ({
      key: `c:${c}`,
      label: cuisineLabel(t, c),
      remove: () => store.toggleCuisine(c),
    })),
  ];
}

/**
 * «Фильтры · N» opens a sheet with every filter and the sort. Next to it: the sort and the
 * active filters (tap ✕ to remove), or a few quick ones while none is on.
 */
export function RecipeFilterBar({ resultCount, cuisines }: Props) {
  const t = useT();
  const sheetRef = useRef<BottomSheetModal>(null);
  const filters = useRecipeFilterState();
  const sort = useRecipeFilters((s) => s.sort);
  const store = useRecipeFilters.getState();
  const count = useActiveFilterCount();
  const active = activeChips(t, filters, store);

  const chip = (key: string | number, label: string, on: boolean, onPress: () => void) => (
    <Chip
      key={key}
      mode={on ? 'flat' : 'outlined'}
      selected={on}
      showSelectedCheck
      onPress={onPress}
      accessibilityState={{ selected: on }}>
      {label}
    </Chip>
  );
  const group = (id: string, title: string, chips: ReactNode) => (
    <View key={id} style={styles.group}>
      <Text variant="titleSmall">{title}</Text>
      <View style={styles.wrap}>{chips}</View>
    </View>
  );
  const groupTitle = (id: string) => t(`recipes.browse.groups.${id as 'diet'}`);
  const toggleGroup = (id: string) => {
    const g = FILTER_GROUPS.find((x) => x.id === id)!;
    return group(
      id,
      groupTitle(id),
      g.filters.map((f) =>
        chip(f, t(`recipes.filters.${f}`), filters.toggles.includes(f), () => store.toggle(f)),
      ),
    );
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled">
        <Chip
          icon="tune-variant"
          mode={count > 0 ? 'flat' : 'outlined'}
          selected={count > 0}
          showSelectedCheck={false}
          onPress={() => sheetRef.current?.present()}
          compact>
          {count > 0 ? t('recipes.browse.filtersCount', { count }) : t('recipes.browse.filters')}
        </Chip>
        {sort ? (
          <Chip compact icon="sort" mode="flat" onClose={() => store.setSort(null)}>
            {t(`recipes.sort.${sort}`)}
          </Chip>
        ) : null}
        {count > 0
          ? active.map((a) => (
              <Chip key={a.key} mode="flat" onClose={a.remove} compact>
                {a.label}
              </Chip>
            ))
          : QUICK.map((f) => (
              <Chip key={f} mode="outlined" onPress={() => store.toggle(f)} compact>
                {t(`recipes.filters.${f}`)}
              </Chip>
            ))}
      </ScrollView>

      <AppBottomSheet sheetRef={sheetRef}>
        <Text variant="titleLarge" accessibilityRole="header">
          {t('recipes.browse.filters')}
        </Text>
        {group('sort', groupTitle('sort'), [
          chip('none', t('recipes.sort.none'), sort === null, () => store.setSort(null)),
          ...RECIPE_SORTS.map((s) =>
            chip(s, t(`recipes.sort.${s}`), sort === s, () => store.setSort(s)),
          ),
        ])}
        {toggleGroup('stock')}
        {group(
          'kcal',
          groupTitle('kcal'),
          KCAL_RANGE_IDS.map((k) =>
            chip(k, t(`recipes.filters.kcal.${k}`), filters.kcal === k, () =>
              store.pick('kcal', k),
            ),
          ),
        )}
        {group(
          'minProtein',
          groupTitle('minProtein'),
          MIN_PROTEIN.map((g) =>
            chip(g, t('recipes.filters.minProtein', { grams: g }), filters.minProtein === g, () =>
              store.pick('minProtein', g),
            ),
          ),
        )}
        {group(
          'minDensity',
          groupTitle('minDensity'),
          MIN_DENSITY.map((g) =>
            chip(g, t('recipes.filters.minDensity', { grams: g }), filters.minDensity === g, () =>
              store.pick('minDensity', g),
            ),
          ),
        )}
        {group(
          'maxMinutes',
          groupTitle('maxMinutes'),
          MAX_MINUTES.map((m) =>
            chip(m, t('recipes.filters.maxMinutes', { minutes: m }), filters.maxMinutes === m, () =>
              store.pick('maxMinutes', m),
            ),
          ),
        )}
        {group(
          'maxIngredients',
          groupTitle('maxIngredients'),
          MAX_INGREDIENTS.map((n) =>
            chip(
              n,
              t('recipes.filters.maxIngredients', { count: n }),
              filters.maxIngredients === n,
              () => store.pick('maxIngredients', n),
            ),
          ),
        )}
        {toggleGroup('equipment')}
        {toggleGroup('diet')}
        {toggleGroup('more')}
        {group(
          'protein',
          groupTitle('protein'),
          PROTEINS.map((p) =>
            chip(p, t(`recipes.shelves.${p}`), filters.proteins.includes(p), () =>
              store.toggleProtein(p),
            ),
          ),
        )}
        {cuisines.length > 0
          ? group(
              'cuisine',
              groupTitle('cuisine'),
              cuisines.map((c) =>
                chip(c, cuisineLabel(t, c), filters.cuisines.includes(c), () =>
                  store.toggleCuisine(c),
                ),
              ),
            )
          : null}
        {group(
          'source',
          groupTitle('source'),
          RECIPE_SOURCES.map((s) =>
            chip(s, t(`recipes.filters.source.${s}`), filters.source === s, () =>
              store.pick('source', s),
            ),
          ),
        )}
        <View style={styles.actions}>
          <Button onPress={store.clear} disabled={count === 0}>
            {t('recipes.browse.reset')}
          </Button>
          <Button mode="contained" style={styles.flex} onPress={() => sheetRef.current?.dismiss()}>
            {t('recipes.browse.show', { count: resultCount })}
          </Button>
        </View>
      </AppBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  group: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingTop: spacing.sm },
});
