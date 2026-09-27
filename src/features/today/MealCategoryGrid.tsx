import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import type { MealType } from '@/domain/types';
import { MEAL_ICONS, MEAL_LABELS, MEAL_ORDER } from '@/features/meals';
import { formatInt } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';

type Props = { kcalRanges: Partial<Record<MealType, { min: number; max: number }>> };

const rangeLabel = (r?: { min: number; max: number }) => {
  if (!r) return '';
  const min = Math.round(r.min / 10) * 10;
  const max = Math.round(r.max / 10) * 10;
  return min === max ? `~${formatInt(min)} ккал` : `${formatInt(min)}–${formatInt(max)} ккал`;
};

/** 2×2 entry points into the recipe lists. Photos arrive in phase 8; icons until then. */
export function MealCategoryGrid({ kcalRanges }: Props) {
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
          <View style={[styles.image, { backgroundColor: theme.colors.secondaryContainer }]}>
            <MaterialCommunityIcons
              name={MEAL_ICONS[meal]}
              size={40}
              color={theme.colors.onSecondaryContainer}
              importantForAccessibility="no"
            />
          </View>
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
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  text: { paddingVertical: spacing.md, gap: 2 },
});
