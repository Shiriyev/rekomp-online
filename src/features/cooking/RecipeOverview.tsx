import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import type { Ingredient, RecipeIngredient, RecipeStep } from '@/db/schema';
import { durationParts, recipeOverview, stepIngredients } from '@/domain/cooking';
import type { AltChoices } from '@/domain/nutrition';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount, formatDecimal } from '@/lib/format';
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
  const t = useT();
  const content = useContent();
  const { entries, timedTotalMin } = recipeOverview(steps);
  const recipeId = steps[0]?.recipeId ?? '';
  const duration = (seconds: number) => {
    const d = durationParts(seconds);
    return d.unit === 'sec'
      ? t('cooking.overview.seconds', { value: d.value })
      : t('cooking.overview.minutes', { value: formatDecimal(d.value) });
  };

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
            const i = ingredients.get(u.ingredientId);
            const name = i ? content.ingredientName(i).toLocaleLowerCase() : u.ingredientId;
            return u.amount === null
              ? t('cooking.overview.toTaste', { name })
              : `${name} ${formatAmount(u.amount, u.unit)}`;
          })
          .join(', ');
        return (
          <View key={e.order} style={styles.entry} accessible>
            <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
              {i + 1}.{' '}
              {e.timerSec
                ? t('cooking.overview.withDuration', {
                    lead: t(`cooking.overview.${e.position}`),
                    duration: duration(e.timerSec),
                  })
                : t(`cooking.overview.${e.position}`)}
              {e.timerSec && e.startsAtMin > 0
                ? t('cooking.overview.fromMinute', { minute: e.startsAtMin })
                : ''}
            </Text>
            <Text variant="bodyLarge">
              {content.stepText(
                recipeId,
                e.order,
                e.text,
                steps.find((s) => s.order === e.order)?.textEn,
              )}
            </Text>
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
          {t('cooking.overview.total', { minutes: timedTotalMin })}
        </Text>
      ) : null}
      <Button mode="contained" icon="check" onPress={onFinish} contentStyle={styles.big}>
        {t('cooking.overview.allDone')}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  entry: { gap: spacing.xs },
  big: { minHeight: 56 },
});
