import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState, type RefObject } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { z } from 'zod';

import { usePantryItems } from '@/db/hooks';
import type { Ingredient } from '@/db/schema';
import { numberText } from '@/features/forms/numberText';
import { ProductRow } from '@/features/products/ProductRow';
import { ProductToolbar } from '@/features/products/ProductToolbar';
import { useProductBrowser } from '@/features/products/useProductBrowser';
import { useT, useUnitLabel } from '@/i18n';
import { content as contentNames, useContent } from '@/i18n/content';
import { formatAmount, formatInputNumber } from '@/lib/format';
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

/** A sheet is not a list view: past this, the search or a category narrows it down. */
const MAX_RESULTS = 40;

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
  const pantry = usePantryItems();

  const stock = useMemo(() => new Map(pantry.map((p) => [p.ingredientId, p.quantity])), [pantry]);
  const available = useMemo(
    () => ingredients.filter((i) => !i.isStaple && !i.isArchived && i.stockTracked),
    [ingredients],
  );
  const browser = useProductBrowser('shopping', available, stock);
  const results = browser.results.slice(0, MAX_RESULTS);

  const amountForm = useForm<z.input<typeof amountSchema>, unknown, z.output<typeof amountSchema>>({
    resolver: zodResolver(amountSchema),
    defaultValues: { amount: '' },
  });
  const reset = () => {
    setStep({ kind: 'search' });
    browser.setQuery('');
  };

  const pick = (ingredient: Ingredient) => {
    amountForm.reset({ amount: formatInputNumber(defaultAmount(ingredient)) });
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
          <View style={styles.toolbar}>
            <ProductToolbar
              browser={browser}
              screen="shopping"
              renderInput={sheetInput}
              inset={0}
              viewToggle={false}
            />
          </View>
          {browser.similar && results.length > 0 ? (
            <Text variant="labelLarge">{t('products.similar')}</Text>
          ) : null}
          <View>
            {results.map((i) => (
              <ProductRow
                key={i.id}
                ingredient={i}
                subtitle={describe?.(i) ?? undefined}
                onPress={() => pick(i)}
              />
            ))}
          </View>
          {results.length === 0 ? (
            <View style={styles.empty}>
              <Text variant="titleMedium">{t('products.nothing')}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('products.nothingHint')}
              </Text>
              <Button
                onPress={() => {
                  browser.reset();
                  browser.setQuery('');
                }}>
                {t('products.reset')}
              </Button>
            </View>
          ) : browser.results.length > MAX_RESULTS ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('pantry.picker.more', { count: browser.results.length - MAX_RESULTS })}
            </Text>
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
  toolbar: { marginTop: -spacing.md },
  empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
});
