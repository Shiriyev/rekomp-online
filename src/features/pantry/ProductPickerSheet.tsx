import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState, type RefObject } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, List, Text, TextInput } from 'react-native-paper';
import { z } from 'zod';

import type { Ingredient } from '@/db/schema';
import { searchIngredients, suggestSimilar } from '@/domain/search';
import { numberText } from '@/features/forms/numberText';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { useT, useUnitLabel } from '@/i18n';
import { content as contentNames, useContent } from '@/i18n/content';
import { formatAmount, formatDecimal } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';
import { NumberField } from '@/ui/NumberField';
import { sheetInput } from '@/ui/sheetInput';

import { NotInCatalog } from './NotInCatalog';

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

const MAX_RESULTS = 30;

const amountSchema = z.object({ amount: numberText({ min: 0.5, max: 100_000 }) });

type Step = { kind: 'search' } | { kind: 'amount'; ingredient: Ingredient };

/**
 * Pick a catalog product and an amount. Products come only from the catalog: a search
 * that finds nothing offers look-alikes instead of creating a product.
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
  const t = useT();
  const content = useContent();
  const unitLabel = useUnitLabel();
  const [step, setStep] = useState<Step>({ kind: 'search' });
  const [query, setQuery] = useState('');

  const available = useMemo(
    () =>
      ingredients
        .filter((i) => !i.isStaple && !i.isArchived)
        .map((i) => ({ ...i, aliases: content.searchAliases(i) })),
    [ingredients, content],
  );
  const results = useMemo(
    () => searchIngredients(available, query).slice(0, MAX_RESULTS),
    [available, query],
  );
  const suggestions = useMemo(
    () => (results.length === 0 ? suggestSimilar(available, query) : []),
    [available, query, results.length],
  );

  const amountForm = useForm<z.input<typeof amountSchema>, unknown, z.output<typeof amountSchema>>({
    resolver: zodResolver(amountSchema),
    defaultValues: { amount: '' },
  });
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

  return (
    <AppBottomSheet sheetRef={sheetRef} onOpen={reset}>
      {step.kind === 'search' ? (
        <>
          <Text variant="titleLarge" accessibilityRole="header">
            {title}
          </Text>
          <TextInput
            mode="outlined"
            label={t('pantry.picker.search')}
            accessibilityLabel={t('pantry.picker.searchLabel')}
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
                title={content.ingredientName(i)}
                description={[i.nameHu, describe?.(i)].filter(Boolean).join(' · ')}
                left={(props) => <List.Icon {...props} icon={CATEGORY_ICONS[i.category]} />}
                onPress={() => pick(i)}
                style={styles.item}
              />
            ))}
          </View>
          {query.trim() && results.length === 0 ? (
            <NotInCatalog suggestions={suggestions} onPick={pick} />
          ) : null}
        </>
      ) : null}

      {step.kind === 'amount' ? (
        <>
          <Text variant="titleLarge" accessibilityRole="header">
            {content.ingredientName(step.ingredient)}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {amountHint}
          </Text>
          <NumberField
            control={amountForm.control}
            name="amount"
            label={t('pantry.picker.amount')}
            suffix={unitLabel(step.ingredient.unit)}
            render={sheetInput}
          />
          <View style={styles.row}>
            <Button onPress={() => setStep({ kind: 'search' })}>{t('common.actions.back')}</Button>
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
    </AppBottomSheet>
  );
}

/** «Творог 350 г» style label used across the tab. */
export const stockLabel = (i: Ingredient, quantity: number) =>
  `${contentNames.ingredientName(i)} ${formatAmount(quantity, i.unit)}`;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  item: { minHeight: 56 },
});
