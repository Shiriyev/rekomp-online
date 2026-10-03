import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';

import { MAIN_PROTEINS } from '@/db/catalog/schema';
import { FILTER_GROUPS, type RecipeFilter } from '@/domain/browse';
import { useT } from '@/i18n';
import { spacing } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';

import { useActiveFilterCount, useRecipeFilters } from './recipeFiltersStore';

/** Shown as quick chips while no filter is on: the ones people reach for most. */
const QUICK: readonly RecipeFilter[] = ['cookable', 'no_stove', 'no_oven', 'vegetarian', 'quick15'];
/** «Другое» is not a useful choice in the sheet. */
const PROTEINS = MAIN_PROTEINS.filter((p) => p !== 'other');

type Props = {
  /** Recipes matching the current filters, for «Показать N блюд». */
  resultCount: number;
};

/**
 * «Фильтры · N» opens a sheet with every filter in groups (kitchen equipment, diet, time,
 * main ingredient). Next to it: the active filters (tap to remove), or a few quick ones.
 */
export function RecipeFilterBar({ resultCount }: Props) {
  const t = useT();
  const sheetRef = useRef<BottomSheetModal>(null);
  const active = useRecipeFilters((s) => s.active);
  const proteins = useRecipeFilters((s) => s.proteins);
  const toggle = useRecipeFilters((s) => s.toggle);
  const toggleProtein = useRecipeFilters((s) => s.toggleProtein);
  const clear = useRecipeFilters((s) => s.clear);
  const count = useActiveFilterCount();

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
        {count > 0 ? (
          <>
            {active.map((f) => (
              <Chip key={f} mode="flat" onClose={() => toggle(f)} compact>
                {t(`recipes.filters.${f}`)}
              </Chip>
            ))}
            {proteins.map((p) => (
              <Chip key={p} mode="flat" onClose={() => toggleProtein(p)} compact>
                {t(`recipes.shelves.${p as (typeof PROTEINS)[number]}`)}
              </Chip>
            ))}
          </>
        ) : (
          QUICK.map((f) => (
            <Chip key={f} mode="outlined" onPress={() => toggle(f)} compact>
              {t(`recipes.filters.${f}`)}
            </Chip>
          ))
        )}
      </ScrollView>

      <AppBottomSheet sheetRef={sheetRef}>
        <Text variant="titleLarge" accessibilityRole="header">
          {t('recipes.browse.filters')}
        </Text>
        {FILTER_GROUPS.map((group) => (
          <View key={group.id} style={styles.group}>
            <Text variant="titleSmall">
              {t(`recipes.browse.groups.${group.id as 'equipment'}`)}
            </Text>
            <View style={styles.wrap}>
              {group.filters.map((f) => {
                const on = active.includes(f);
                return (
                  <Chip
                    key={f}
                    mode={on ? 'flat' : 'outlined'}
                    selected={on}
                    showSelectedCheck
                    onPress={() => toggle(f)}
                    accessibilityState={{ selected: on }}>
                    {t(`recipes.filters.${f}`)}
                  </Chip>
                );
              })}
            </View>
          </View>
        ))}
        <View style={styles.group}>
          <Text variant="titleSmall">{t('recipes.browse.groups.protein')}</Text>
          <View style={styles.wrap}>
            {PROTEINS.map((p) => {
              const on = proteins.includes(p);
              return (
                <Chip
                  key={p}
                  mode={on ? 'flat' : 'outlined'}
                  selected={on}
                  showSelectedCheck
                  onPress={() => toggleProtein(p)}
                  accessibilityState={{ selected: on }}>
                  {t(`recipes.shelves.${p}`)}
                </Chip>
              );
            })}
          </View>
        </View>
        <View style={styles.actions}>
          <Button onPress={clear} disabled={count === 0}>
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
