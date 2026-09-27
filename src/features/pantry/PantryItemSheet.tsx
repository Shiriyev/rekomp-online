import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { z } from 'zod';

import { repositories } from '@/db';
import type { Ingredient } from '@/db/schema';
import { defaultLowStockThreshold } from '@/domain/stock';
import type { Unit } from '@/domain/types';
import { numberText, optionalNumberText } from '@/features/forms/numberText';
import { formatDecimal } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';
import { NumberField } from '@/ui/NumberField';
import { sheetInput } from '@/ui/sheetInput';

const UNIT_LABELS: Record<Unit, string> = { g: 'г', ml: 'мл', pcs: 'шт' };

const schema = z.object({
  quantity: numberText({ min: 0, max: 1_000_000 }),
  lowStockThreshold: optionalNumberText({ min: 0, max: 100_000 }),
  kcalPer100g: numberText({ min: 0, max: 900 }),
  proteinPer100g: numberText({ min: 0, max: 100 }),
  gramsPerPiece: optionalNumberText({ min: 1, max: 5000 }),
});
type Values = z.input<typeof schema>;

export type PantryItemSheetHandle = { open: (ingredient: Ingredient, quantity: number) => void };

type Props = {
  ref: Ref<PantryItemSheetHandle>;
  onRemove: (ingredient: Ingredient, quantity: number) => void;
};

const toText = (n: number | null) => (n === null ? '' : formatDecimal(n));

/** Edit one pantry item: exact amount, «мало» threshold and the ingredient's КБЖУ. */
export function PantryItemSheet({ ref, onRemove }: Props) {
  const theme = useAppTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [current, setCurrent] = useState<{ ingredient: Ingredient; quantity: number } | null>(null);
  const { control, handleSubmit, reset, setError } = useForm<
    Values,
    unknown,
    z.output<typeof schema>
  >({
    resolver: zodResolver(schema),
  });

  // Filled from the arguments, so the form never shows the previous item's values.
  useImperativeHandle(ref, () => ({
    open: (ingredient, quantity) => {
      setCurrent({ ingredient, quantity });
      reset({
        quantity: toText(quantity),
        lowStockThreshold: toText(ingredient.lowStockThreshold),
        kcalPer100g: toText(ingredient.kcalPer100g),
        proteinPer100g: toText(ingredient.proteinPer100g),
        gramsPerPiece: toText(ingredient.gramsPerPiece),
      });
      sheetRef.current?.present();
    },
  }));

  const ingredient = current?.ingredient;

  const save = () =>
    handleSubmit((v) => {
      if (!ingredient) return;
      if (ingredient.unit === 'pcs' && v.gramsPerPiece === null) {
        setError('gramsPerPiece', { message: 'Нужен вес 1 шт' });
        return;
      }
      repositories.ingredients.updateSettings(ingredient.id, {
        kcalPer100g: v.kcalPer100g,
        proteinPer100g: v.proteinPer100g,
        gramsPerPiece: ingredient.unit === 'pcs' ? v.gramsPerPiece : ingredient.gramsPerPiece,
        lowStockThreshold: v.lowStockThreshold,
      });
      repositories.pantry.setQuantity(ingredient.id, v.quantity);
      sheetRef.current?.dismiss();
    })();

  return (
    <AppBottomSheet sheetRef={sheetRef}>
      {ingredient && current ? (
        <>
          <Text variant="titleLarge" accessibilityRole="header">
            {ingredient.name}
          </Text>
          <View style={styles.row}>
            <NumberField
              control={control}
              name="quantity"
              label="Дома"
              suffix={UNIT_LABELS[ingredient.unit]}
              render={sheetInput}
            />
            <NumberField
              control={control}
              name="lowStockThreshold"
              label={`Мало, если < ${defaultLowStockThreshold(ingredient.unit)}`}
              suffix={UNIT_LABELS[ingredient.unit]}
              render={sheetInput}
            />
          </View>
          <Text variant="titleSmall">КБЖУ на 100 г</Text>
          <View style={styles.row}>
            <NumberField control={control} name="kcalPer100g" label="Ккал" render={sheetInput} />
            <NumberField
              control={control}
              name="proteinPer100g"
              label="Белок, г"
              render={sheetInput}
            />
            {ingredient.unit === 'pcs' ? (
              <NumberField
                control={control}
                name="gramsPerPiece"
                label="Вес 1 шт"
                suffix="г"
                render={sheetInput}
              />
            ) : null}
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Значения ориентировочные — проверь по этикетке. Изменения пересчитают КБЖУ блюд.
          </Text>
          <View style={styles.row}>
            <Button
              textColor={theme.colors.error}
              icon="delete-outline"
              onPress={() => {
                onRemove(ingredient, current.quantity);
                sheetRef.current?.dismiss();
              }}>
              Убрать
            </Button>
            <Button mode="contained" style={styles.flex} onPress={save}>
              Сохранить
            </Button>
          </View>
        </>
      ) : null}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
