import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';

import { RECIPE_FILTERS } from '@/domain/browse';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import { useRecipeFilters } from './recipeFiltersStore';

/** One row of quick filters («Нет плиты», «Без свинины», «До 15 мин»), scrolls sideways. */
export function RecipeFilterChips() {
  const t = useT();
  const active = useRecipeFilters((s) => s.active);
  const toggle = useRecipeFilters((s) => s.toggle);
  const clear = useRecipeFilters((s) => s.clear);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled">
      {active.length > 0 ? (
        <Chip icon="close" mode="outlined" onPress={clear} compact>
          {t('recipes.browse.clearFilters')}
        </Chip>
      ) : null}
      {RECIPE_FILTERS.map((f) => {
        const on = active.includes(f);
        return (
          <Chip
            key={f}
            mode={on ? 'flat' : 'outlined'}
            selected={on}
            showSelectedCheck
            onPress={() => toggle(f)}
            compact
            accessibilityState={{ selected: on }}>
            {t(`recipes.filters.${f}`)}
          </Chip>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
