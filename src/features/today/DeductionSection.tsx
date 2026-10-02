import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text, TextInput } from 'react-native-paper';

import { useIngredientsMap, usePantryItems, usePantryStock } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import {
  deductionStep,
  defaultDeductionAmount,
  planManualDeduction,
  type DeductionItem,
} from '@/domain/manualEntry';
import { searchIngredients } from '@/domain/search';
import { bundledImage } from '@/features/bundledImage';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { AmountInput } from '@/ui/AmountInput';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

type Props = {
  value: DeductionItem[];
  onChange: (items: DeductionItem[]) => void;
  /** «Посчитать ккал и белок по продуктам». */
  onCalculate: () => void;
};

const MAX_RESULTS = 6;

/** Collapsible «Списать с продуктов»: pick from «Дома», set amounts, see what remains. */
export function DeductionSection({ value, onChange, onCalculate }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const pantryItems = usePantryItems();
  const stock = usePantryStock();
  const ingredients = useIngredientsMap();

  const atHome = useMemo(
    () =>
      pantryItems.flatMap((p) => {
        const i = ingredients.get(p.ingredientId);
        return i && !i.isStaple && p.quantity > 0 ? [i] : [];
      }),
    [pantryItems, ingredients],
  );
  const results = useMemo(() => {
    const chosen = new Set(value.map((v) => v.ingredientId));
    // Once something is picked, more products come from the search, so the page stays short.
    if (chosen.size > 0 && query.trim() === '') return [];
    return searchIngredients(
      atHome.map((i) => ({ ...i, aliases: content.searchAliases(i) })),
      query,
    )
      .filter((i) => !chosen.has(i.id))
      .slice(0, MAX_RESULTS);
  }, [atHome, query, value, content]);
  const plan = useMemo(
    () => (ingredients.size > 0 ? planManualDeduction(value, ingredients, stock) : null),
    [value, ingredients, stock],
  );

  const add = (ingredient: Ingredient) => {
    const available = stock.get(ingredient.id)?.quantity ?? 0;
    onChange([
      ...value,
      { ingredientId: ingredient.id, amount: defaultDeductionAmount(ingredient.unit, available) },
    ]);
    setQuery('');
  };
  const remove = (ingredientId: string) =>
    onChange(value.filter((v) => v.ingredientId !== ingredientId));
  const setAmount = (ingredientId: string, amount: number) =>
    onChange(value.map((v) => (v.ingredientId === ingredientId ? { ...v, amount } : v)));

  const thumb = (i: Ingredient) => (
    <ImageWithFallback
      source={bundledImage(i.imageKey)}
      fallbackIcon={CATEGORY_ICONS[i.category]}
      style={styles.thumb}
      iconSize={20}
    />
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: theme.colors.secondaryContainer }]}>
          <MaterialCommunityIcons
            name="fridge-outline"
            size={22}
            color={theme.colors.onSecondaryContainer}
          />
        </View>
        <View style={styles.flex}>
          <Text variant="titleMedium">{t('addMeal.products.title')}</Text>
          <Text
            variant="bodySmall"
            style={{
              color: value.length > 0 ? theme.colors.primary : theme.colors.onSurfaceVariant,
            }}>
            {value.length > 0
              ? t('addMeal.products.selected', { count: value.length })
              : t('addMeal.products.optional')}
          </Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {atHome.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('addMeal.products.empty')}
            </Text>
          ) : (
            <>
              {value.length === 0 ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('addMeal.products.hint')}
                </Text>
              ) : null}

              {value.map((item) => {
                const ingredient = ingredients.get(item.ingredientId);
                if (!ingredient) return null;
                const line = plan?.lines.find((l) => l.ingredientId === item.ingredientId);
                const short = line ? line.amount > line.available : false;
                const name = content.ingredientName(ingredient);
                return (
                  <View key={item.ingredientId} style={styles.selected}>
                    <View style={styles.selectedTop}>
                      {thumb(ingredient)}
                      <View style={styles.flex}>
                        <Text variant="bodyLarge" numberOfLines={1}>
                          {name}
                        </Text>
                        {line ? (
                          <Text
                            variant="bodySmall"
                            style={{
                              color: short ? theme.colors.warning : theme.colors.onSurfaceVariant,
                            }}>
                            {short
                              ? t('addMeal.products.notEnough', {
                                  have: formatAmount(line.available, line.unit),
                                })
                              : t('addMeal.products.remains', {
                                  have: formatAmount(line.available, line.unit),
                                  after: formatAmount(line.after, line.unit),
                                })}
                          </Text>
                        ) : null}
                      </View>
                      <IconButton
                        icon="close"
                        size={20}
                        onPress={() => remove(item.ingredientId)}
                        accessibilityLabel={t('addMeal.products.remove', { name })}
                      />
                    </View>
                    <View style={styles.stepperRow}>
                      <AmountInput
                        label={name}
                        value={item.amount}
                        onChange={(n) => setAmount(item.ingredientId, n)}
                        unit={ingredient.unit}
                        step={deductionStep(ingredient.unit)}
                      />
                    </View>
                  </View>
                );
              })}

              <TextInput
                mode="outlined"
                dense
                placeholder={
                  value.length > 0 ? t('addMeal.products.searchMore') : t('addMeal.products.search')
                }
                accessibilityLabel={t('addMeal.products.search')}
                value={query}
                onChangeText={setQuery}
                left={<TextInput.Icon icon="magnify" />}
                autoCorrect={false}
                outlineStyle={styles.searchOutline}
              />

              {results.map((i) => (
                <Pressable
                  key={i.id}
                  onPress={() => add(i)}
                  accessibilityRole="button"
                  accessibilityLabel={content.ingredientName(i)}
                  android_ripple={{ color: theme.colors.primary }}
                  style={styles.result}>
                  {thumb(i)}
                  <Text variant="bodyLarge" style={styles.flex} numberOfLines={1}>
                    {content.ingredientName(i)}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {formatAmount(stock.get(i.id)?.quantity ?? 0, i.unit)}
                  </Text>
                  <MaterialCommunityIcons
                    name="plus-circle-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                </Pressable>
              ))}

              {value.length > 0 ? (
                <Button
                  mode="text"
                  icon="calculator-variant-outline"
                  onPress={onCalculate}
                  style={styles.calculate}>
                  {t('addMeal.products.calculate')}
                </Button>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    minHeight: 64,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  selected: { gap: spacing.xs, paddingBottom: spacing.sm },
  selectedTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepperRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  thumb: { width: 40, height: 40, borderRadius: radius.sm },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    borderRadius: radius.md,
  },
  searchOutline: { borderRadius: radius.md },
  calculate: { alignSelf: 'flex-start' },
});
