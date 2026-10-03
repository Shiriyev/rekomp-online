import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { ReactNode, RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';

import {
  countProductFilters,
  HIGH_PROTEIN_PER_100G,
  PRODUCT_DIETS,
  PRODUCT_KCAL_IDS,
  PRODUCT_SORTS,
  PRODUCT_STOCK,
  type ProductStock,
} from '@/domain/productFilters';
import { useT } from '@/i18n';
import { spacing } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';

import type { ProductScreen } from './productFiltersStore';
import type { ProductBrowser } from './useProductBrowser';

/** «Дома» lists only what is at home: there, «есть / нет дома» would mean nothing. */
const STOCK_BY_SCREEN: Record<ProductScreen, readonly ProductStock[]> = {
  home: ['low'],
  add: PRODUCT_STOCK,
  shopping: PRODUCT_STOCK,
};

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  browser: ProductBrowser;
  screen: ProductScreen;
};

/** Every product filter at once, plus the sort; «Показать N» closes the sheet. */
export function ProductFilterSheet({ sheetRef, browser, screen }: Props) {
  const t = useT();
  const { state, update, reset, results } = browser;
  const active = countProductFilters(state);

  const chip = (key: string, label: string, on: boolean, onPress: () => void) => (
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
  const group = (title: string, chips: ReactNode) => (
    <View style={styles.group}>
      <Text variant="titleSmall">{title}</Text>
      <View style={styles.wrap}>{chips}</View>
    </View>
  );

  return (
    <AppBottomSheet sheetRef={sheetRef}>
      <Text variant="titleLarge" accessibilityRole="header">
        {t('products.filters')}
      </Text>
      {group(
        t('products.groups.sort'),
        PRODUCT_SORTS.map((s) =>
          chip(s, t(`products.sort.${s}`), state.sort === s, () => update({ sort: s })),
        ),
      )}
      {group(
        t('products.groups.stock'),
        STOCK_BY_SCREEN[screen].map((s) =>
          chip(s, t(`products.stock.${s}`), state.stock === s, () =>
            update({ stock: state.stock === s ? null : s }),
          ),
        ),
      )}
      {group(t('products.groups.useful'), [
        chip('used', t('products.usedInRecipes'), state.usedInRecipes, () =>
          update({ usedInRecipes: !state.usedInRecipes }),
        ),
        chip(
          'protein',
          t('products.highProtein', { grams: HIGH_PROTEIN_PER_100G }),
          state.highProtein,
          () => update({ highProtein: !state.highProtein }),
        ),
      ])}
      {group(
        t('products.groups.kcal'),
        PRODUCT_KCAL_IDS.map((k) =>
          chip(k, t(`products.kcal.${k}`), state.kcal === k, () =>
            update({ kcal: state.kcal === k ? null : k }),
          ),
        ),
      )}
      {group(
        t('products.groups.diet'),
        PRODUCT_DIETS.map((d) => {
          const on = state.diets.includes(d);
          return chip(d, t(`products.diets.${d}`), on, () =>
            update({ diets: on ? state.diets.filter((x) => x !== d) : [...state.diets, d] }),
          );
        }),
      )}
      <View style={styles.actions}>
        <Button onPress={reset} disabled={active === 0 && state.category === null}>
          {t('products.reset')}
        </Button>
        <Button mode="contained" style={styles.flex} onPress={() => sheetRef.current?.dismiss()}>
          {t('products.show', { count: results.length })}
        </Button>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', paddingTop: spacing.sm },
});
