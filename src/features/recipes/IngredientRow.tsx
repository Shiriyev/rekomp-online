import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import type { Ingredient, LidlProduct, RecipeIngredient } from '@/db/schema';
import type { LineCheck } from '@/domain/pantry';
import { INGREDIENT_IMAGES } from '@/features/images';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { formatAmount, formatDayMonth } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

type Props = {
  check: LineCheck<RecipeIngredient>;
  ingredient: Ingredient;
  alternatives: Ingredient[];
  sale: LidlProduct | undefined;
  /** Notes such as «1 ч.л.» are per serving. */
  servings: number;
  onChooseAlternative: (ingredientId: string) => void;
};

const STATUS = {
  ok: { icon: 'check-circle', label: 'есть' },
  low: { icon: 'alert', label: 'мало' },
  missing: { icon: 'close-circle', label: 'нет' },
} as const;

export function IngredientRow({
  check,
  ingredient,
  alternatives,
  sale,
  servings,
  onChooseAlternative,
}: Props) {
  const theme = useAppTheme();
  const color =
    check.status === 'ok'
      ? theme.colors.success
      : check.status === 'low'
        ? theme.colors.warning
        : theme.colors.error;
  const status = STATUS[check.status];
  const amount = formatAmount(check.required, check.unit);
  const detail =
    check.status === 'low'
      ? `${status.label}: ${formatAmount(check.available, check.unit)}`
      : status.label;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${ingredient.name}, ${amount}, ${detail}`}>
      <ImageWithFallback
        source={ingredient.imageKey ? INGREDIENT_IMAGES[ingredient.imageKey] : undefined}
        fallbackIcon={CATEGORY_ICONS[ingredient.category]}
        style={styles.image}
        iconSize={24}
      />
      <View style={styles.body}>
        <Text variant="bodyLarge">{ingredient.name}</Text>
        {check.line.note ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {servings > 1 ? `${check.line.note} на порцию` : check.line.note}
          </Text>
        ) : null}
        {sale ? (
          <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
            Скидка в Lidl{sale.saleUntil ? ` до ${formatDayMonth(sale.saleUntil)}` : ''}
          </Text>
        ) : null}
        {alternatives.length > 0 ? (
          <View style={styles.alts}>
            {alternatives.map((alt) => (
              <Chip
                key={alt.id}
                compact
                icon="swap-horizontal"
                onPress={() => onChooseAlternative(alt.id)}>
                или {alt.name}
              </Chip>
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text variant="titleSmall">{amount}</Text>
        <View style={styles.status}>
          <MaterialCommunityIcons
            name={status.icon}
            size={16}
            color={color}
            importantForAccessibility="no"
          />
          <Text variant="bodySmall" style={{ color }}>
            {detail}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  image: { width: 48, height: 48, borderRadius: radius.sm },
  body: { flex: 1, gap: 2 },
  alts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  right: { alignItems: 'flex-end', gap: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
