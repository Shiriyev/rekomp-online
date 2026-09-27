import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import type { Ingredient, RecipeIngredient, RecipeStep } from '@/db/schema';
import { recipeOverview, stepIngredients } from '@/domain/cooking';
import type { AltChoices } from '@/domain/nutrition';
import { formatAmount } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

type Props = {
  steps: RecipeStep[];
  lines: RecipeIngredient[];
  ingredients: ReadonlyMap<string, Ingredient>;
  servings: number;
  choices: AltChoices;
  onFinish: () => void;
};

/** The whole recipe on one page: «Сначала 6 мин: …, затем …» with amounts inline. */
export function RecipeOverview({ steps, lines, ingredients, servings, choices, onFinish }: Props) {
  const theme = useAppTheme();
  const { entries, timedTotalMin } = recipeOverview(steps);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {entries.map((e, i) => {
        const used = stepIngredients(
          steps.find((s) => s.order === e.order)?.ingredientRefs ?? [],
          lines,
          ingredients,
          servings,
          choices,
        );
        const amounts = used
          .map((u) => {
            const name =
              ingredients.get(u.ingredientId)?.name.toLocaleLowerCase('ru-RU') ?? u.ingredientId;
            return u.amount === null
              ? `${name} по вкусу`
              : `${name} ${formatAmount(u.amount, u.unit)}`;
          })
          .join(', ');
        return (
          <View key={e.order} style={styles.entry} accessible>
            <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
              {i + 1}. {e.lead}
              {e.timerSec && e.startsAtMin > 0 ? ` (с ${e.startsAtMin}-й мин)` : ''}
            </Text>
            <Text variant="bodyLarge">{e.text}</Text>
            {amounts ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {amounts}
              </Text>
            ) : null}
          </View>
        );
      })}
      {timedTotalMin > 0 ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          По таймерам ≈ {timedTotalMin} мин (часть шагов можно делать параллельно).
        </Text>
      ) : null}
      <Button mode="contained" icon="check" onPress={onFinish} contentStyle={styles.big}>
        Всё готово
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  entry: { gap: spacing.xs },
  big: { minHeight: 56 },
});
