import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { z } from 'zod';

import { repositories } from '@/db';
import type { MealLog } from '@/db/schema';
import { MEAL_TYPES } from '@/domain/types';
import { numberText } from '@/features/forms/numberText';
import { MEAL_LABELS, MEAL_ORDER } from '@/features/meals';
import { formatDecimal } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';
import { NumberField } from '@/ui/NumberField';
import { sheetInput } from '@/ui/sheetInput';

const schema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(80),
  kcal: numberText({ min: 0, max: 5000 }, true),
  protein: numberText({ min: 0, max: 500 }),
  mealType: z.enum(MEAL_TYPES),
});
type Values = z.input<typeof schema>;

export type EditEntrySheetHandle = { open: (log: MealLog) => void };

type Props = { ref: Ref<EditEntrySheetHandle>; onDelete: (log: MealLog) => void };

export function EditEntrySheet({ ref, onDelete }: Props) {
  const theme = useAppTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [log, setLog] = useState<MealLog | null>(null);
  const { control, handleSubmit, reset } = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
  });

  useImperativeHandle(ref, () => ({
    open: (next) => {
      setLog(next);
      reset({
        name: next.name,
        kcal: String(next.kcal),
        protein: formatDecimal(next.protein),
        mealType: next.mealType,
      });
      sheetRef.current?.present();
    },
  }));

  const save = () =>
    handleSubmit((v) => {
      if (!log) return;
      repositories.logs.update(log.id, v);
      sheetRef.current?.dismiss();
    })();

  return (
    <AppBottomSheet sheetRef={sheetRef}>
      {log ? (
        <>
          <Text variant="titleLarge" accessibilityRole="header">
            Изменить запись
          </Text>
          {log.source === 'manual' ? (
            <Controller
              control={control}
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
          ) : (
            <Text variant="titleMedium">{log.name}</Text>
          )}
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
          <View style={styles.row}>
            <Button
              icon="delete-outline"
              textColor={theme.colors.error}
              onPress={() => {
                sheetRef.current?.dismiss();
                onDelete(log);
              }}>
              Удалить
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
