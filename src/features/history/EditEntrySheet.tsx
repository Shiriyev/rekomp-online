import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Keyboard, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  IconButton,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { z } from 'zod';

import { repositories } from '@/db';
import type { MealLog } from '@/db/schema';
import { deviceTimeZone, getLogicalDate } from '@/domain/day';
import {
  isAllowedEntryTime,
  joinDateTime,
  parseTimeOfDay,
  shiftDate,
  splitTimestamp,
} from '@/domain/entryDetail';
import { MEAL_TYPES } from '@/domain/types';
import { numberText } from '@/features/forms/numberText';
import { MEAL_LABELS, MEAL_ORDER } from '@/features/meals';
import { useT, useTranslateMessage } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatDayLabel, formatDecimal } from '@/lib/format';
import { useClock } from '@/lib/useClock';
import { spacing, useAppTheme } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';
import { NumberField } from '@/ui/NumberField';
import { sheetInput } from '@/ui/sheetInput';

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(80, 'validation.maxLength|80'),
  kcal: numberText({ min: 0, max: 5000 }, true),
  protein: numberText({ min: 0, max: 500 }),
  mealType: z.enum(MEAL_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().refine((t) => parseTimeOfDay(t) !== null, 'validation.timeFormat'),
});
type Values = z.input<typeof schema>;

export type EditEntrySheetHandle = { open: (log: MealLog) => void };

type Props = {
  ref: Ref<EditEntrySheetHandle>;
  /** Shown as a button in the sheet when given. */
  onDelete?: (log: MealLog) => void;
};

/** Edit name (manual), kcal, protein, meal and time; a new time may move the entry to another day. */
export function EditEntrySheet({ ref, onDelete }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const translate = useTranslateMessage();
  const content = useContent();
  const { now, today: logicalToday, dayStartHour } = useClock();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [log, setLog] = useState<MealLog | null>(null);
  const { control, handleSubmit, reset, setValue, setError } = useForm<
    Values,
    unknown,
    z.output<typeof schema>
  >({ resolver: zodResolver(schema) });
  const date = useWatch({ control, name: 'date' });
  const time = useWatch({ control, name: 'time' });

  useImperativeHandle(ref, () => ({
    open: (next) => {
      setLog(next);
      reset({
        name: next.name,
        kcal: String(next.kcal),
        protein: formatDecimal(next.protein),
        mealType: next.mealType,
        ...splitTimestamp(next.timestamp),
      });
      sheetRef.current?.present();
    },
  }));

  const today = splitTimestamp(now.getTime()).date;
  const parsedTime = time ? parseTimeOfDay(time) : null;
  const newTimestamp =
    date && parsedTime ? joinDateTime(date, parsedTime.hour, parsedTime.minute) : null;
  const logicalDay =
    newTimestamp !== null ? getLogicalDate(newTimestamp, dayStartHour, deviceTimeZone()) : null;

  const save = () =>
    handleSubmit(({ date: d, time: hhmm, ...v }) => {
      if (!log) return;
      const parsed = parseTimeOfDay(hhmm)!;
      const timestamp = joinDateTime(d, parsed.hour, parsed.minute);
      if (!isAllowedEntryTime(timestamp, Date.now())) {
        setError('time', { message: 'validation.futureTime' });
        return;
      }
      repositories.logs.update(log.id, { ...v, timestamp });
      Keyboard.dismiss();
      sheetRef.current?.dismiss();
    })();

  return (
    <AppBottomSheet sheetRef={sheetRef}>
      {log ? (
        <>
          <Text variant="titleLarge" accessibilityRole="header">
            {t('history.edit.title')}
          </Text>
          {log.source === 'manual' ? (
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <View>
                  <TextInput
                    mode="outlined"
                    label={t('history.edit.name')}
                    accessibilityLabel={t('history.edit.name')}
                    value={field.value}
                    onChangeText={field.onChange}
                    error={!!fieldState.error}
                    render={sheetInput}
                  />
                  {fieldState.error ? (
                    <HelperText type="error" padding="none">
                      {translate(fieldState.error.message)}
                    </HelperText>
                  ) : null}
                </View>
              )}
            />
          ) : (
            <Text variant="titleMedium">{content.entryName(log)}</Text>
          )}
          <View style={styles.row}>
            <NumberField
              control={control}
              name="kcal"
              label={t('history.edit.kcal')}
              suffix={t('common.kcal')}
              integer
              render={sheetInput}
            />
            <NumberField
              control={control}
              name="protein"
              label={t('history.edit.protein')}
              suffix={t('common.grams')}
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
            <IconButton
              icon="chevron-left"
              mode="outlined"
              onPress={() => date && setValue('date', shiftDate(date, -1))}
              accessibilityLabel={t('history.edit.dayEarlier')}
            />
            <Text variant="bodyLarge" style={styles.dateLabel}>
              {date ? formatDayLabel(date, today, shiftDate(today, -1)) : ''}
            </Text>
            <IconButton
              icon="chevron-right"
              mode="outlined"
              disabled={!date || date >= today}
              onPress={() => date && setValue('date', shiftDate(date, 1))}
              accessibilityLabel={t('history.edit.dayLater')}
            />
            <Controller
              control={control}
              name="time"
              render={({ field, fieldState }) => (
                <TextInput
                  mode="outlined"
                  dense
                  label={t('history.edit.time')}
                  accessibilityLabel={t('history.edit.timeA11y')}
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  error={!!fieldState.error}
                  style={styles.time}
                  render={sheetInput}
                />
              )}
            />
          </View>
          <Controller
            control={control}
            name="time"
            render={({ fieldState }) =>
              fieldState.error ? (
                <HelperText type="error" padding="none">
                  {translate(fieldState.error.message)}
                </HelperText>
              ) : logicalDay && logicalDay !== log.localDate ? (
                <Text variant="bodySmall" style={{ color: theme.colors.warning }}>
                  {t('history.edit.movesTo', {
                    day: formatDayLabel(logicalDay, logicalToday, shiftDate(logicalToday, -1)),
                  })}
                </Text>
              ) : (
                <></>
              )
            }
          />

          <View style={styles.row}>
            {onDelete ? (
              <Button
                icon="delete-outline"
                textColor={theme.colors.error}
                onPress={() => {
                  sheetRef.current?.dismiss();
                  onDelete(log);
                }}>
                {t('common.actions.delete')}
              </Button>
            ) : null}
            <Button mode="contained" style={styles.flex} onPress={save}>
              {t('common.actions.save')}
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
  dateLabel: { flex: 1, textAlign: 'center' },
  time: { width: 92 },
});
