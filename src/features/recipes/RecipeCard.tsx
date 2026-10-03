import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, IconButton, Text } from 'react-native-paper';

import { repositories } from '@/db';
import type { Recipe } from '@/db/schema';
import type { Macros, MealType } from '@/domain/types';
import { MEAL_ICONS } from '@/features/meals';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatInt, formatKcal } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

import { recipeImage } from './recipeImage';

type Props = {
  recipe: Recipe;
  macros: Macros;
  /** Products missing at home (0 = everything there). */
  missing: number;
  /** The list it is shown in: the card is titled with this meal. */
  meal?: MealType;
  /** Fixed width in a horizontal shelf; grids let it fill the column. */
  width?: number;
  /** Saved to «Избранное»: a filled heart; tapping the heart toggles it. */
  favorite?: boolean;
};

/** Photo card of a recipe for shelves and grids: name, kcal · protein, time, stock status. */
export const RecipeCard = memo(function RecipeCard({
  recipe,
  macros,
  missing,
  meal,
  width,
  favorite = false,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const name = content.recipeName(recipe);
  const ready = missing === 0;
  const statusColor = ready ? theme.colors.success : theme.colors.warning;

  return (
    <Card
      mode="contained"
      style={[styles.card, width ? { width } : styles.fill]}
      onPress={() =>
        router.push({
          pathname: '/recipe/[id]',
          params: meal ? { id: recipe.id, meal } : { id: recipe.id },
        })
      }
      accessibilityLabel={t('recipes.listA11y', {
        name,
        kcal: formatInt(macros.kcal),
        protein: formatInt(macros.protein),
      })}>
      <View>
        <ImageWithFallback
          source={recipeImage(recipe)}
          fallbackIcon={MEAL_ICONS[recipe.mealType]}
          style={styles.image}
          iconSize={36}
        />
        <IconButton
          icon={favorite ? 'heart' : 'heart-outline'}
          iconColor={favorite ? theme.colors.error : '#FFFFFF'}
          containerColor="rgba(0,0,0,0.45)"
          mode="contained"
          size={18}
          style={styles.heart}
          onPress={() => repositories.recipes.toggleFavorite(recipe.id)}
          accessibilityLabel={favorite ? t('recipes.browse.unsave') : t('recipes.browse.save')}
          accessibilityState={{ selected: favorite }}
        />
      </View>
      <View style={styles.body}>
        <Text variant="titleSmall" numberOfLines={2} style={styles.name}>
          {name}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
          numberOfLines={1}>
          {t('recipes.browse.cardMeta', {
            kcal: formatKcal(macros.kcal),
            protein: formatInt(macros.protein),
          })}
        </Text>
        <View style={styles.footer}>
          <View style={styles.status}>
            <MaterialCommunityIcons
              name={ready ? 'check-circle-outline' : 'cart-outline'}
              size={14}
              color={statusColor}
            />
            <Text variant="labelSmall" style={{ color: statusColor }}>
              {ready ? t('recipes.browse.ready') : t('recipes.browse.missing', { count: missing })}
            </Text>
          </View>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('recipes.browse.minutes', { minutes: recipe.totalMinutes })}
          </Text>
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: radius.md },
  fill: { flex: 1 },
  image: { width: '100%', aspectRatio: 4 / 3 },
  heart: { position: 'absolute', top: 2, right: 2, margin: 0 },
  body: { padding: spacing.sm, gap: 2 },
  // Two lines reserved so cards in a row line up.
  name: { minHeight: 40 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
