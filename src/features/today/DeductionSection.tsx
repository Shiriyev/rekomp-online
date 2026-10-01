import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, List, Text, TextInput } from 'react-native-paper';

import { useIngredientsMap, usePantryItems, usePantryStock } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import {
  deductionStep,
  defaultDeductionAmount,
  planManualDeduction,
  type DeductionItem,
} from '@/domain/manualEntry';
import { searchIngredients } from '@/domain/search';
import { formatAmount } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { AmountInput } from '@/ui/AmountInput';
import { sheetInput } from '@/ui/sheetInput';

type Props = {
  value: DeductionItem[];
  onChange: (items: DeductionItem[]) => void;
  /** «Посчитать ккал и белок по продуктам». */
  onCalculate: () => void;
};

const MAX_RESULTS = 8;

/** Collapsed block «Списать с продуктов»: pick from «Дома», set amounts, see what remains. */
export function DeductionSection({ value, onChange, onCalculate }: Props) {
  const theme = useAppTheme();
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
  const selected = new Set(value.map((v) => v.ingredientId));
  // Selection survives a new search query: ticked products always stay on top.
  const results = useMemo(() => {
    const chosen = new Set(value.map((v) => v.ingredientId));
    // Once something is ticked, the full list would push «Добавить» off screen:
    // further products are found through the search.
    if (chosen.size > 0 && query.trim() === '') return [];
    return searchIngredients(atHome, query)
      .filter((i) => !chosen.has(i.id))
      .slice(0, MAX_RESULTS);
  }, [atHome, query, value]);
  const plan = useMemo(
    () => (ingredients.size > 0 ? planManualDeduction(value, ingredients, stock) : null),
    [value, ingredients, stock],
  );

  const toggle = (ingredient: Ingredient) => {
    if (selected.has(ingredient.id)) {
      onChange(value.filter((v) => v.ingredientId !== ingredient.id));
      return;
    }
    const available = stock.get(ingredient.id)?.quantity ?? 0;
    onChange([
      ...value,
      { ingredientId: ingredient.id, amount: defaultDeductionAmount(ingredient.unit, available) },
    ]);
  };

  const setAmount = (ingredientId: string, amount: number) =>
    onChange(value.map((v) => (v.ingredientId === ingredientId ? { ...v, amount } : v)));

  const title =
    value.length > 0
      ? `Списать с продуктов · выбрано ${value.length}`
      : 'Списать с продуктов (необязательно)';

  return (
    <List.Accordion
      title={title}
      expanded={expanded}
      onPress={() => setExpanded((e) => !e)}
      left={(props) => <List.Icon {...props} icon="fridge-outline" />}
      style={styles.accordion}>
      <View style={styles.body}>
        {atHome.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Дома пока ничего нет — продукты добавляются во вкладке «Продукты».
          </Text>
        ) : (
          <TextInput
            mode="outlined"
            dense
            label={value.length > 0 ? 'Добавить ещё продукт' : 'Найти дома'}
            accessibilityLabel="Найти продукт дома"
            value={query}
            onChangeText={setQuery}
            left={<TextInput.Icon icon="magnify" />}
            render={sheetInput}
            autoCorrect={false}
          />
        )}

        {value.map((item) => {
          const ingredient = ingredients.get(item.ingredientId);
          if (!ingredient) return null;
          const line = plan?.lines.find((l) => l.ingredientId === item.ingredientId);
          return (
            <View key={item.ingredientId} style={styles.selected}>
              <Checkbox.Item
                label={ingredient.name}
                status="checked"
                onPress={() => toggle(ingredient)}
                position="leading"
                style={styles.check}
                labelStyle={styles.label}
              />
              <View style={styles.amountRow}>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.flex,
                    {
                      color:
                        line && line.amount > line.available
                          ? theme.colors.warning
                          : theme.colors.onSurfaceVariant,
                    },
                  ]}>
                  {line
                    ? `${ingredient.name}: ${formatAmount(line.available, line.unit)} → останется ${formatAmount(line.after, line.unit)}`
                    : ''}
                </Text>
                <AmountInput
                  label={ingredient.name}
                  value={item.amount}
                  onChange={(n) => setAmount(item.ingredientId, n)}
                  unit={ingredient.unit}
                  step={deductionStep(ingredient.unit)}
                  render={sheetInput}
                />
              </View>
            </View>
          );
        })}

        {results.map((i) => (
          <Checkbox.Item
            key={i.id}
            label={`${i.name} · ${formatAmount(stock.get(i.id)?.quantity ?? 0, i.unit)}`}
            status="unchecked"
            onPress={() => toggle(i)}
            position="leading"
            style={styles.check}
            labelStyle={styles.label}
          />
        ))}

        {value.length > 0 ? (
          <Button mode="outlined" icon="calculator-variant-outline" onPress={onCalculate}>
            Посчитать ккал и белок по продуктам
          </Button>
        ) : null}
      </View>
    </List.Accordion>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  accordion: { paddingHorizontal: 0, backgroundColor: 'transparent' },
  body: { gap: spacing.xs },
  selected: { gap: 0 },
  check: { paddingHorizontal: 0, minHeight: 48 },
  label: { textAlign: 'left' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
