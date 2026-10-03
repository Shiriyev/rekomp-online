import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, IconButton, TextInput, type TextInputProps } from 'react-native-paper';

import { CATALOG_CATEGORIES } from '@/db/catalog/schema';
import { countProductFilters } from '@/domain/productFilters';
import { INGREDIENT_CATEGORIES } from '@/domain/types';
import { CATEGORY_ICONS, useCategoryLabel } from '@/features/ingredients';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import { ProductFilterSheet } from './ProductFilterSheet';
import type { ProductScreen } from './productFiltersStore';
import type { ProductBrowser } from './useProductBrowser';

type Props = {
  browser: ProductBrowser;
  screen: ProductScreen;
  /** Chips right after «Фильтры» (e.g. «Выбрано · 3»). */
  extraChips?: ReactNode;
  /** Text field renderer: `sheetInput` inside a bottom sheet. */
  renderInput?: TextInputProps['render'];
  /** Side padding of the rows, matching the list below. */
  inset?: number;
  /** The grid/list switch (lists inside sheets have no grid). */
  viewToggle?: boolean;
};

/**
 * Search field with the grid/list switch, then «Фильтры · N», the sort and category chips,
 * and the subcategories of the chosen category («Курица», «Фарш», …).
 */
export function ProductToolbar({
  browser,
  screen,
  extraChips,
  renderInput,
  inset = spacing.lg,
  viewToggle = true,
}: Props) {
  const t = useT();
  const categoryLabel = useCategoryLabel();
  const sheetRef = useRef<BottomSheetModal>(null);
  const { state, update, counts, query, setQuery } = browser;
  const active = countProductFilters(state);
  const subcategories = state.category
    ? (CATALOG_CATEGORIES[state.category] as readonly string[]).filter((s) =>
        counts.subcategories.has(s),
      )
    : [];
  const row = [styles.chips, { paddingHorizontal: inset }];

  return (
    <View>
      <View
        style={[
          styles.search,
          { paddingLeft: inset, paddingRight: viewToggle ? inset - spacing.sm : inset },
        ]}>
        <TextInput
          mode="outlined"
          dense
          style={styles.flex}
          placeholder={t('products.search')}
          accessibilityLabel={t('products.searchLabel')}
          value={query}
          onChangeText={setQuery}
          left={<TextInput.Icon icon="magnify" />}
          right={query ? <TextInput.Icon icon="close" onPress={() => setQuery('')} /> : undefined}
          autoCorrect={false}
          render={renderInput}
        />
        {viewToggle ? (
          <IconButton
            icon={state.view === 'grid' ? 'view-list-outline' : 'view-grid-outline'}
            onPress={() => update({ view: state.view === 'grid' ? 'list' : 'grid' })}
            accessibilityLabel={t(
              state.view === 'grid' ? 'products.view.toList' : 'products.view.toGrid',
            )}
          />
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={row}
        keyboardShouldPersistTaps="handled">
        <Chip
          compact
          icon="tune-variant"
          mode={active > 0 ? 'flat' : 'outlined'}
          selected={active > 0}
          showSelectedCheck={false}
          onPress={() => sheetRef.current?.present()}>
          {active > 0 ? t('products.filtersCount', { count: active }) : t('products.filters')}
        </Chip>
        <Chip compact icon="sort" mode="outlined" onPress={() => sheetRef.current?.present()}>
          {t(`products.sort.${state.sort}`)}
        </Chip>
        {extraChips}
        <Chip
          compact
          mode={state.category === null ? 'flat' : 'outlined'}
          selected={state.category === null}
          showSelectedCheck={false}
          onPress={() => update({ category: null, subcategory: null })}>
          {`${t('products.all')} · ${counts.total}`}
        </Chip>
        {INGREDIENT_CATEGORIES.flatMap((c) => {
          const n = counts.categories.get(c) ?? 0;
          if (n === 0 && state.category !== c) return [];
          const on = state.category === c;
          return [
            <Chip
              key={c}
              compact
              icon={CATEGORY_ICONS[c]}
              mode={on ? 'flat' : 'outlined'}
              selected={on}
              showSelectedCheck={false}
              onPress={() => update({ category: on ? null : c, subcategory: null })}>
              {`${categoryLabel(c)} · ${n}`}
            </Chip>,
          ];
        })}
      </ScrollView>
      {state.category && subcategories.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[row, styles.subRow]}
          keyboardShouldPersistTaps="handled">
          {subcategories.map((s) => {
            const on = state.subcategory === s;
            return (
              <Chip
                key={s}
                compact
                mode={on ? 'flat' : 'outlined'}
                selected={on}
                onPress={() => update({ subcategory: on ? null : s })}>
                {`${t(`products.subcategories.${state.category}.${s}` as 'products.subcategories.other.other')} · ${counts.subcategories.get(s)}`}
              </Chip>
            );
          })}
        </ScrollView>
      ) : null}
      <ProductFilterSheet sheetRef={sheetRef} browser={browser} screen={screen} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.md },
  chips: { gap: spacing.sm, paddingVertical: spacing.sm },
  subRow: { paddingTop: 0 },
});
