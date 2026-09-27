import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState, type RefObject } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, List, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { z } from 'zod';

import { repositories } from '@/db';
import type { Ingredient } from '@/db/schema';
import { searchIngredients } from '@/domain/search';
import { INGREDIENT_CATEGORIES, UNITS, type Unit } from '@/domain/types';
import { numberText, optionalNumberText } from '@/features/forms/numberText';
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/features/ingredients';
import { formatAmount, formatDecimal } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';
import { NumberField } from '@/ui/NumberField';
import { sheetInput } from '@/ui/sheetInput';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  ingredients: Ingredient[];
  title: string;
  /** Shown above the amount field, e.g. «к тому, что уже есть». */
  amountHint: string;
  submitLabel: string;
  /** Extra line in the search results (e.g. «дома: 350 г», «уже в списке»). */
  describe?: (ingredient: Ingredient) => string | null;
  defaultAmount: (ingredient: Ingredient) => number;
  onSubmit: (ingredient: Ingredient, amount: number) => void;
};

const UNIT_LABELS: Record<Unit, string> = { g: 'г', ml: 'мл', pcs: 'шт' };
const MAX_RESULTS = 30;

const amountSchema = z.object({ amount: numberText({ min: 0.5, max: 100_000 }) });

const customSchema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(60),
  category: z.enum(INGREDIENT_CATEGORIES),
  unit: z.enum(UNITS),
  gramsPerPiece: optionalNumberText({ min: 1, max: 5000 }),
  kcalPer100g: numberText({ min: 0, max: 900 }),
  proteinPer100g: numberText({ min: 0, max: 100 }),
  amount: numberText({ min: 0.5, max: 100_000 }),
});

type Step = { kind: 'search' } | { kind: 'amount'; ingredient: Ingredient } | { kind: 'custom' };

/**
 * Pick a catalog product and an amount. Unknown products are created first
 * (custom ingredient), so everything stays linked to the catalog.
 */
export function ProductPickerSheet({
  sheetRef,
  ingredients,
  title,
  amountHint,
  submitLabel,
  describe,
  defaultAmount,
  onSubmit,
}: Props) {
  const theme = useAppTheme();
  const [step, setStep] = useState<Step>({ kind: 'search' });
  const [query, setQuery] = useState('');

  const results = useMemo(
    () =>
      searchIngredients(
        ingredients.filter((i) => !i.isStaple),
        query,
      ).slice(0, MAX_RESULTS),
    [ingredients, query],
  );

  const amountForm = useForm<z.input<typeof amountSchema>, unknown, z.output<typeof amountSchema>>({
    resolver: zodResolver(amountSchema),
    defaultValues: { amount: '' },
  });
  const customForm = useForm<z.input<typeof customSchema>, unknown, z.output<typeof customSchema>>({
    resolver: zodResolver(customSchema),
  });
  const customUnit = useWatch({ control: customForm.control, name: 'unit' });

  const reset = () => {
    setStep({ kind: 'search' });
    setQuery('');
  };

  const pick = (ingredient: Ingredient) => {
    amountForm.reset({ amount: formatDecimal(defaultAmount(ingredient)) });
    setStep({ kind: 'amount', ingredient });
  };

  const add = (ingredient: Ingredient, amount: number) => {
    onSubmit(ingredient, amount);
    sheetRef.current?.dismiss();
  };

  const startCustom = () => {
    customForm.reset({
      name: query.trim(),
      category: 'dairy',
      unit: 'g',
      gramsPerPiece: '',
      kcalPer100g: '',
      proteinPer100g: '',
      amount: '',
    });
    setStep({ kind: 'custom' });
  };

  return (
    <AppBottomSheet sheetRef={sheetRef} onOpen={reset}>
      {step.kind === 'search' ? (
        <>
          <Text variant="titleLarge" accessibilityRole="header">
            {title}
          </Text>
          <TextInput
            mode="outlined"
            label="Поиск: творог, túró…"
            accessibilityLabel="Поиск продукта"
            value={query}
            onChangeText={setQuery}
            left={<TextInput.Icon icon="magnify" />}
            render={sheetInput}
            autoCorrect={false}
          />
          <View>
            {results.map((i) => (
              <List.Item
                key={i.id}
                title={i.name}
                description={[i.nameHu, describe?.(i)].filter(Boolean).join(' · ')}
                left={(props) => <List.Icon {...props} icon={CATEGORY_ICONS[i.category]} />}
                onPress={() => pick(i)}
                style={styles.item}
              />
            ))}
          </View>
          <Button mode="outlined" icon="plus" onPress={startCustom}>
            {query.trim() ? `Новый продукт «${query.trim()}»` : 'Новый продукт'}
          </Button>
        </>
      ) : null}

      {step.kind === 'amount' ? (
        <>
          <Text variant="titleLarge" accessibilityRole="header">
            {step.ingredient.name}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {amountHint}
          </Text>
          <NumberField
            control={amountForm.control}
            name="amount"
            label="Количество"
            suffix={UNIT_LABELS[step.ingredient.unit]}
            render={sheetInput}
          />
          <View style={styles.row}>
            <Button onPress={() => setStep({ kind: 'search' })}>Назад</Button>
            <Button
              mode="contained"
              style={styles.flex}
              onPress={() =>
                amountForm.handleSubmit(({ amount }) => add(step.ingredient, amount))()
              }>
              {submitLabel}
            </Button>
          </View>
        </>
      ) : null}

      {step.kind === 'custom' ? (
        <>
          <Text variant="titleLarge" accessibilityRole="header">
            Новый продукт
          </Text>
          <Controller
            control={customForm.control}
            name="name"
            render={({ field, fieldState }) => (
              <View>
                <TextInput
                  mode="outlined"
                  label="Название"
                  accessibilityLabel="Название"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={!!fieldState.error}
                  render={sheetInput}
                />
                {fieldState.error ? (
                  <HelperText type="error" padding="none">
                    {fieldState.error.message}
                  </HelperText>
                ) : null}
              </View>
            )}
          />
          <Controller
            control={customForm.control}
            name="category"
            render={({ field }) => (
              <View style={styles.chips}>
                {INGREDIENT_CATEGORIES.filter((c) => c !== 'spices').map((c) => (
                  <Button
                    key={c}
                    compact
                    mode={field.value === c ? 'contained-tonal' : 'outlined'}
                    icon={CATEGORY_ICONS[c]}
                    onPress={() => field.onChange(c)}>
                    {CATEGORY_LABELS[c]}
                  </Button>
                ))}
              </View>
            )}
          />
          <Controller
            control={customForm.control}
            name="unit"
            render={({ field }) => (
              <SegmentedButtons
                value={field.value}
                onValueChange={field.onChange}
                buttons={[
                  { value: 'g', label: 'Граммы' },
                  { value: 'ml', label: 'Мл' },
                  { value: 'pcs', label: 'Штуки' },
                ]}
              />
            )}
          />
          {customUnit === 'pcs' ? (
            <NumberField
              control={customForm.control}
              name="gramsPerPiece"
              label="Вес 1 шт"
              suffix="г"
              render={sheetInput}
            />
          ) : null}
          <View style={styles.row}>
            <NumberField
              control={customForm.control}
              name="kcalPer100g"
              label="Ккал / 100 г"
              render={sheetInput}
            />
            <NumberField
              control={customForm.control}
              name="proteinPer100g"
              label="Белок / 100 г"
              render={sheetInput}
            />
          </View>
          <NumberField
            control={customForm.control}
            name="amount"
            label="Количество"
            suffix={UNIT_LABELS[customUnit ?? 'g']}
            render={sheetInput}
          />
          <View style={styles.row}>
            <Button onPress={() => setStep({ kind: 'search' })}>Назад</Button>
            <Button
              mode="contained"
              style={styles.flex}
              onPress={() =>
                customForm.handleSubmit(({ amount, ...values }) => {
                  if (values.unit === 'pcs' && values.gramsPerPiece === null) {
                    customForm.setError('gramsPerPiece', { message: 'Укажите вес одной штуки' });
                    return;
                  }
                  const created = repositories.ingredients.createCustom(values);
                  add(created, amount);
                })()
              }>
              Создать: {submitLabel.toLocaleLowerCase('ru-RU')}
            </Button>
          </View>
        </>
      ) : null}
    </AppBottomSheet>
  );
}

/** «Творог 350 г» style label used across the tab. */
export const stockLabel = (i: Ingredient, quantity: number) =>
  `${i.name} ${formatAmount(quantity, i.unit)}`;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: { minHeight: 56 },
});
