import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import type { Ingredient, LidlProduct, RecipeIngredient } from '@/db/schema';
import type { LineCheck } from '@/domain/pantry';
import { bundledImage } from '@/features/bundledImage';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount, formatDayMonth } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { AmountInput } from '@/ui/AmountInput';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

/** The editable amount of a line on the recipe card (per serving, in the line's unit). */
export type LineEditor = {
  value: number;
  base: number;
  step: number;
  onChange: (amount: number) => void;
};

type Props = {
  check: LineCheck<RecipeIngredient>;
  ingredient: Ingredient;
  alternatives: Ingredient[];
  sale: LidlProduct | undefined;
  /** Notes such as «1 ч.л.» are per serving. */
  servings: number;
  onChooseAlternative: (ingredientId: string) => void;
  editor?: LineEditor;
};

const STATUS_ICON = { ok: 'check-circle', low: 'alert', missing: 'close-circle' } as const;

/** Ingredient on the recipe card: photo, name, availability pill and the amount stepper. */
export function IngredientRow({
  check,
  ingredient,
  alternatives,
  sale,
  servings,
  onChooseAlternative,
  editor,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const name = content.ingredientName(ingredient);
  const color =
    check.status === 'ok'
      ? theme.colors.success
      : check.status === 'low'
        ? theme.colors.warning
        : theme.colors.error;
  const amount = formatAmount(check.required, check.unit);
  const detail =
    check.status === 'low'
      ? t('recipes.row.low', { amount: formatAmount(check.available, check.unit) })
      : t(check.status === 'ok' ? 'recipes.row.ok' : 'recipes.row.missing');
  const changed = editor ? Math.abs(editor.value - editor.base) > 1e-9 : false;
  const unit = check.line.unit;
  const note = content.lineNote(
    check.line.recipeId,
    check.line.ingredientId,
    check.line.note,
    check.line.noteEn,
  );

  return (
    <View style={styles.row}>
      <View
        style={styles.top}
        accessible
        accessibilityLabel={`${name}, ${amount}, ${detail}${changed ? `, ${t('recipes.row.changed')}` : ''}`}>
        <ImageWithFallback
          source={bundledImage(ingredient.imageKey)}
          fallbackIcon={CATEGORY_ICONS[ingredient.category]}
          style={styles.image}
          iconSize={24}
        />
        <View style={styles.body}>
          <Text variant="titleMedium" numberOfLines={2}>
            {name}
          </Text>
          {note ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {servings > 1 ? t('recipes.row.notePerServing', { note }) : note}
            </Text>
          ) : null}
          {sale ? (
            <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
              {sale.saleUntil
                ? t('recipes.row.saleUntil', { date: formatDayMonth(sale.saleUntil) })
                : t('recipes.row.sale')}
            </Text>
          ) : null}
        </View>
        <View style={[styles.status, { borderColor: color }]}>
          <MaterialCommunityIcons
            name={STATUS_ICON[check.status]}
            size={14}
            color={color}
            importantForAccessibility="no"
          />
          <Text variant="labelMedium" style={{ color }}>
            {detail}
          </Text>
        </View>
      </View>

      {alternatives.length > 0 ? (
        <View style={styles.alts}>
          {alternatives.map((alt) => (
            <Chip
              key={alt.id}
              compact
              mode="outlined"
              icon="swap-horizontal"
              onPress={() => onChooseAlternative(alt.id)}>
              {t('recipes.row.alternative', { name: content.ingredientName(alt) })}
            </Chip>
          ))}
        </View>
      ) : null}

      {editor ? (
        <View style={styles.editor}>
          <View style={styles.caption}>
            {/* Per serving is the default; only the pot total adds information. */}
            {servings > 1 ? (
              <Text
                variant="bodySmall"
                style={{ color: changed ? theme.colors.primary : theme.colors.onSurfaceVariant }}>
                {t('recipes.card.totalAmount', {
                  amount: formatAmount(editor.value * servings, unit),
                })}
              </Text>
            ) : null}
            {changed ? (
              <Pressable
                onPress={() => editor.onChange(editor.base)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('recipes.card.resetLine', { name })}
                style={styles.reset}>
                <MaterialCommunityIcons name="restore" size={14} color={theme.colors.primary} />
                <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                  {t('recipes.card.inRecipe', { amount: formatAmount(editor.base, unit) })}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <AmountInput
            label={name}
            value={editor.value}
            onChange={editor.onChange}
            unit={unit}
            step={editor.step}
            highlighted={changed}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  image: { width: 52, height: 52, borderRadius: radius.md },
  body: { flex: 1, gap: 2 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  alts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingLeft: 52 + spacing.md },
  editor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: 52 + spacing.md,
  },
  caption: { flex: 1, gap: 2 },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
