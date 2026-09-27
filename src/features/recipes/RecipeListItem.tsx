import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { RECIPE_IMAGES } from '@/features/images';
import type { Recipe } from '@/db/schema';
import type { CookCheck } from '@/domain/pantry';
import type { Macros } from '@/domain/types';
import { MEAL_ICONS } from '@/features/meals';
import { formatInt, formatKcal } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

import { StatusBadge } from './StatusBadge';

type Props = { recipe: Recipe; macros: Macros; check: CookCheck; kcalLeftToday: number };

export function RecipeListItem({ recipe, macros, check, kcalLeftToday }: Props) {
  const theme = useAppTheme();
  const after = kcalLeftToday - macros.kcal;

  return (
    <Card
      mode="elevated"
      style={styles.card}
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
      accessibilityLabel={`${recipe.name}, ${formatInt(macros.kcal)} ккал, ${formatInt(macros.protein)} г белка`}>
      <View style={styles.row}>
        <ImageWithFallback
          source={recipe.imageKey ? RECIPE_IMAGES[recipe.imageKey] : undefined}
          fallbackIcon={MEAL_ICONS[recipe.mealType]}
          style={styles.image}
          iconSize={32}
        />
        <View style={styles.body}>
          <Text variant="titleMedium" numberOfLines={2}>
            {recipe.name}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatKcal(macros.kcal)} · {formatInt(macros.protein)} г белка · {recipe.totalMinutes}{' '}
            мин
          </Text>
          <View style={styles.footer}>
            <StatusBadge check={check} />
            <Text
              variant="bodySmall"
              style={{ color: after < 0 ? theme.colors.error : theme.colors.onSurfaceVariant }}>
              {after < 0 ? `перебор ${formatInt(-after)}` : `останется ${formatInt(after)}`}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', padding: spacing.md, gap: spacing.md },
  image: { width: 88, height: 88, borderRadius: radius.md },
  body: { flex: 1, gap: spacing.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: -spacing.sm,
  },
});
