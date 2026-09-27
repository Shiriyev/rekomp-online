import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import type { ManualLogInput } from '@/domain/schemas';
import type { Preset } from '@/domain/today';
import type { MealType } from '@/domain/types';
import { MEAL_LABELS, MEAL_ORDER } from '@/features/meals';
import { formatDecimal, formatInt } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { NumberField } from '@/ui/NumberField';
import { sheetInput } from '@/ui/sheetInput';

import { manualEntryFormSchema, type ManualEntryFormValues } from './manualEntrySchema';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  defaultMealType: MealType;
  presets: Preset[];
  onSubmit: (input: ManualLogInput) => void;
};

const emptyValues = (mealType: MealType): ManualEntryFormValues => ({
  name: '',
  kcal: '',
  protein: '',
  mealType,
});

export function ManualEntrySheet({ sheetRef, defaultMealType, presets, onSubmit }: Props) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  const { control, handleSubmit, reset } = useForm<ManualEntryFormValues, unknown, ManualLogInput>({
    defaultValues: emptyValues(defaultMealType),
    resolver: zodResolver(manualEntryFormSchema),
  });

  // Android back closes the sheet instead of leaving the screen.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      sheetRef.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [open, sheetRef]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  const submit = () =>
    handleSubmit((input) => {
      onSubmit(input);
      sheetRef.current?.dismiss();
    })();

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.elevation.level1 }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
      onAnimate={(fromIndex, toIndex) => {
        // Fresh form each time the sheet opens (not on keyboard-driven re-snaps).
        if (fromIndex === -1 && toIndex >= 0) reset(emptyValues(defaultMealType));
      }}
      onChange={(index) => setOpen(index >= 0)}
      onDismiss={() => setOpen(false)}>
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
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

        <Button mode="contained" onPress={submit} contentStyle={styles.submit}>
          Добавить
        </Button>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  chips: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  submit: { minHeight: 52 },
});
