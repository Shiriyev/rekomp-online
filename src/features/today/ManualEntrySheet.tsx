import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type RefObject } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import type { ManualLogInput } from '@/domain/schemas';
import type { Preset } from '@/domain/today';
import type { MealType } from '@/domain/types';
import { MEAL_LABELS, MEAL_ORDER } from '@/features/meals';
import { PhotoField } from '@/features/photos/PhotoField';
import { formatDecimal, formatInt } from '@/lib/format';
import { spacing } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';
import { NumberField } from '@/ui/NumberField';
import { sheetInput } from '@/ui/sheetInput';

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
  const { control, handleSubmit, reset } = useForm<ManualEntryFormValues, unknown, ManualLogInput>({
    defaultValues: emptyValues(defaultMealType),
    resolver: zodResolver(manualEntryFormSchema),
  });
  const [photo, setPhoto] = useState<string | null>(null);

  const submit = () =>
    handleSubmit((input) => {
      onSubmit(input, photo);
      sheetRef.current?.dismiss();
    })();

  return (
    <AppBottomSheet
      sheetRef={sheetRef}
      // Fresh form each time the sheet opens (not on keyboard-driven re-snaps).
      onOpen={() => {
        reset(emptyValues(defaultMealType));
        setPhoto(null);
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
              onPress={() =>
                reset({
                  name: p.name,
                  kcal: String(p.kcal),
                  protein: formatDecimal(p.protein),
                  mealType: defaultMealType,
                })
              }
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
