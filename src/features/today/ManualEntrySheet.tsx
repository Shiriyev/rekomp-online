import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState, type RefObject } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { useIngredientsMap } from '@/db/hooks';
import { deductionMacros, type DeductionItem } from '@/domain/manualEntry';
import type { ManualLogInput } from '@/domain/schemas';
import type { Preset } from '@/domain/today';
import type { MealType } from '@/domain/types';
import { MEAL_LABELS, MEAL_ORDER } from '@/features/meals';
import { PhotoField } from '@/features/photos/PhotoField';
import { formatAmount, formatDecimal, formatInt } from '@/lib/format';
import { newId } from '@/lib/id';
import { spacing } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';
import { NumberField } from '@/ui/NumberField';
import { sheetInput } from '@/ui/sheetInput';

import { DeductionSection } from './DeductionSection';
import { manualEntryFormSchema, type ManualEntryFormValues } from './manualEntrySchema';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  defaultMealType: MealType;
  presets: Preset[];
  /** `photoTempUri`: a picked, compressed photo in the cache (moved into storage on save). */
  onSubmit: (input: ManualLogInput, photoTempUri: string | null) => void;
};

const emptyValues = (mealType: MealType): ManualEntryFormValues => ({
  name: '',
  kcal: '',
  protein: '',
  mealType,
});

export function ManualEntrySheet({ sheetRef, defaultMealType, presets, onSubmit }: Props) {
  const { control, handleSubmit, reset, setValue, getValues, formState } = useForm<
    ManualEntryFormValues,
    unknown,
    ManualLogInput
  >({
    defaultValues: emptyValues(defaultMealType),
    resolver: zodResolver(manualEntryFormSchema),
  });
  const ingredients = useIngredientsMap();
  const [photo, setPhoto] = useState<string | null>(null);
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);
  // A preset chosen by the user wins over values computed from products.
  const [presetUsed, setPresetUsed] = useState(false);
  // One id per opened form: a second «Добавить» returns the same entry (no duplicate).
  const entryId = useRef(newId());
  const autoName = useRef('');
  const submitting = useRef(false);

  const fillFromProducts = (items: DeductionItem[], force: boolean) => {
    const manualMacros = presetUsed || formState.dirtyFields.kcal || formState.dirtyFields.protein;
    if (force || !manualMacros) {
      const m = deductionMacros(items, ingredients);
      setValue('kcal', String(m.kcal), { shouldValidate: formState.isSubmitted });
      setValue('protein', formatDecimal(m.protein), { shouldValidate: formState.isSubmitted });
    }
    // The name follows the products until the user writes their own.
    const name = getValues('name');
    if (name.trim() === '' || name === autoName.current) {
      const next = items
        .flatMap((item) => {
          const i = ingredients.get(item.ingredientId);
          return i ? [`${i.name} ${formatAmount(item.amount, i.unit)}`] : [];
        })
        .join(', ')
        .slice(0, 80);
      autoName.current = next;
      setValue('name', next, { shouldValidate: formState.isSubmitted });
    }
  };

  const changeDeductions = (items: DeductionItem[]) => {
    setDeductions(items);
    fillFromProducts(items, false);
  };

  const submit = () => {
    if (submitting.current) return;
    submitting.current = true;
    void handleSubmit(
      (input) => {
        try {
          onSubmit({ ...input, id: entryId.current, deductions }, photo);
          Keyboard.dismiss();
          sheetRef.current?.dismiss();
        } finally {
          submitting.current = false;
        }
      },
      () => {
        submitting.current = false;
      },
    )();
  };

  return (
    <AppBottomSheet
      sheetRef={sheetRef}
      // Fresh form each time the sheet opens (not on keyboard-driven re-snaps).
      onOpen={() => {
        reset(emptyValues(defaultMealType));
        setPhoto(null);
        setDeductions([]);
        setPresetUsed(false);
        entryId.current = newId();
        autoName.current = '';
      }}>
      <Text variant="titleLarge" accessibilityRole="header">
        Добавить вручную
      </Text>

      {presets.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {presets.map((p) => (
            <Chip
              key={p.name}
              onPress={() => {
                setPresetUsed(true);
                reset({
                  name: p.name,
                  kcal: String(p.kcal),
                  protein: formatDecimal(p.protein),
                  mealType: defaultMealType,
                });
              }}
              accessibilityLabel={`Заполнить: ${p.name}, ${formatInt(p.kcal)} ккал`}>
              {p.name} · {formatInt(p.kcal)}
            </Chip>
          ))}
        </ScrollView>
      ) : null}

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <View>
            <TextInput
              mode="outlined"
              label="Что съел(а)"
              accessibilityLabel="Что съел(а)"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={!!fieldState.error}
              maxLength={80}
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

      <View style={styles.row}>
        <NumberField
          control={control}
          name="kcal"
          label="Калории"
          suffix="ккал"
          integer
          render={sheetInput}
        />
        <NumberField
          control={control}
          name="protein"
          label="Белок"
          suffix="г"
          render={sheetInput}
        />
      </View>

      <Controller
        control={control}
        name="mealType"
        render={({ field }) => (
          <SegmentedButtons
            value={field.value}
            onValueChange={field.onChange}
            density="small"
            buttons={MEAL_ORDER.map((m) => ({ value: m, label: MEAL_LABELS[m] }))}
          />
        )}
      />

      <DeductionSection
        value={deductions}
        onChange={changeDeductions}
        onCalculate={() => fillFromProducts(deductions, true)}
      />

      <PhotoField value={photo} onChange={setPhoto} />

      <Button mode="contained" onPress={submit} contentStyle={styles.submit}>
        Добавить
      </Button>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  submit: { minHeight: 52 },
});
