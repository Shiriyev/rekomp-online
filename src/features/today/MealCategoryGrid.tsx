import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import type { MealType } from '@/domain/types';
import { MEAL_ICONS, MEAL_LABELS, MEAL_ORDER } from '@/features/meals';
import { t } from '@/i18n';
import { formatInt } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

type Props = {
  kcalRanges: Partial<Record<MealType, { min: number; max: number }>>;
  /** Photo per tile: image key of a representative recipe. */
  /** Tile photo per meal (bundled asset or the user's own photo). */
  coverImages: Partial<Record<MealType, number | { uri: string }>>;
};

const rangeLabel = (r?: { min: number; max: number }) => {
  if (!r) return '';
  const min = Math.round(r.min / 10) * 10;
  const max = Math.round(r.max / 10) * 10;
  return min === max
    ? t('today.grid.kcalAbout', { kcal: formatInt(min) })
    : t('today.grid.kcalRange', { min: formatInt(min), max: formatInt(max) });
};

/** 2×2 entry points into the recipe lists. */
export function MealCategoryGrid({ kcalRanges, coverImages }: Props) {
  const theme = useAppTheme();

  return (
    <View style={styles.grid}>
      {MEAL_ORDER.map((meal) => (
        <Card
          key={meal}
          mode="contained"
          style={styles.tile}
          onPress={() =>
            router.push({ pathname: '/recipes/[mealType]', params: { mealType: meal } })
          }
          accessibilityLabel={`${MEAL_LABELS[meal]}, ${rangeLabel(kcalRanges[meal])}`}>
          <ImageWithFallback
            source={coverImages[meal]}
            fallbackIcon={MEAL_ICONS[meal]}
            style={styles.image}
          />
          <Card.Content style={styles.text}>
            <Text variant="titleMedium">{MEAL_LABELS[meal]}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {rangeLabel(kcalRanges[meal])}
            </Text>
          </Card.Content>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexBasis: '47%', flexGrow: 1, overflow: 'hidden' },
  image: {
    width: '100%',
    height: 96,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  text: { paddingVertical: spacing.md, gap: 2 },
});
