import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  HelperText,
  SegmentedButtons,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIngredientsMap, useRecentPresets } from '@/db/hooks';
import { deductionMacros, type DeductionItem } from '@/domain/manualEntry';
import { parseDecimal, type ManualLogInput } from '@/domain/schemas';
import { suggestMealType } from '@/domain/today';
import { MEAL_ICONS, MEAL_ORDER } from '@/features/meals';
import { PhotoField } from '@/features/photos/PhotoField';
import { DeductionSection } from '@/features/today/DeductionSection';
import {
  manualEntryFormSchema,
  type ManualEntryFormValues,
} from '@/features/today/manualEntrySchema';
import { saveManualEntry } from '@/features/today/saveManualEntry';
import { useT, useTranslateMessage } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount, formatDecimal, formatInt } from '@/lib/format';
import { newId } from '@/lib/id';
import { radius, spacing, useAppTheme } from '@/theme';
import { NumberField } from '@/ui/NumberField';

/** «Добавить еду»: a full page with name and macros, meal, optional products and photo. */
export default function AddMealScreen() {
  const theme = useAppTheme();
  const t = useT();
  const translate = useTranslateMessage();
  const content = useContent();
  const insets = useSafeAreaInsets();
  const presets = useRecentPresets();
  const ingredients = useIngredientsMap();
  const [defaultMeal] = useState(() => suggestMealType(new Date()));

  const { control, handleSubmit, reset, setValue, getValues, formState } = useForm<
    ManualEntryFormValues,
    unknown,
    ManualLogInput
  >({
    defaultValues: { name: '', kcal: '', protein: '', mealType: defaultMeal },
    resolver: zodResolver(manualEntryFormSchema),
  });
  const kcalText = useWatch({ control, name: 'kcal' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [deductions, setDeductions] = useState<DeductionItem[]>([]);
  // A preset chosen by the user wins over values computed from products.
  const [presetUsed, setPresetUsed] = useState(false);
  // One id per opened page: a second «Добавить» returns the same entry (no duplicate).
  const [entryId] = useState(newId);
  const autoName = useRef('');
  const submitting = useRef(false);

  // Keep the page above the keyboard; the offset is the header height.
  const container = useRef<View>(null);
  const [offset, setOffset] = useState(0);

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
          return i ? [`${content.ingredientName(i)} ${formatAmount(item.amount, i.unit)}`] : [];
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
          saveManualEntry({ ...input, id: entryId, deductions }, photo);
          Keyboard.dismiss();
          router.back();
        } finally {
          submitting.current = false;
        }
      },
      () => {
        submitting.current = false;
      },
    )();
  };

  const kcal = parseDecimal(kcalText ?? '');

  return (
    <View
      ref={container}
      style={styles.flex}
      onLayout={() => container.current?.measureInWindow((_x, y) => setOffset(y))}>
      <Stack.Screen options={{ title: t('addMeal.title') }} />
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={offset}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {presets.length > 0 ? (
            <View style={styles.section}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('addMeal.recent')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}>
                {presets.map((p) => (
                  <Chip
                    key={p.name}
                    mode="outlined"
                    icon="history"
                    onPress={() => {
                      setPresetUsed(true);
                      reset({
                        name: p.name,
                        kcal: String(p.kcal),
                        protein: formatDecimal(p.protein),
                        mealType: getValues('mealType'),
                      });
                    }}
                    accessibilityLabel={t('addMeal.fillPreset', {
                      name: p.name,
                      kcal: formatInt(p.kcal),
                    })}>
                    {p.name} · {formatInt(p.kcal)}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <View>
                  <TextInput
                    mode="outlined"
                    label={t('addMeal.name')}
                    placeholder={t('addMeal.namePlaceholder')}
                    accessibilityLabel={t('addMeal.name')}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={!!fieldState.error}
                    maxLength={80}
                    outlineStyle={styles.inputOutline}
                  />
                  {fieldState.error ? (
                    <HelperText type="error" padding="none">
                      {translate(fieldState.error.message)}
                    </HelperText>
                  ) : null}
                </View>
              )}
            />
            <View style={styles.row}>
              <NumberField
                control={control}
                name="kcal"
                label={t('addMeal.kcal')}
                suffix={t('common.kcal')}
                integer
              />
              <NumberField
                control={control}
                name="protein"
                label={t('addMeal.protein')}
                suffix={t('common.grams')}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('addMeal.meal')}
            </Text>
            <Controller
              control={control}
              name="mealType"
              render={({ field }) => (
                <SegmentedButtons
                  value={field.value}
                  onValueChange={field.onChange}
                  density="small"
                  buttons={MEAL_ORDER.map((m) => ({
                    value: m,
                    label: t(`common.meals.${m}`),
                    icon: MEAL_ICONS[m],
                    showSelectedCheck: false,
                  }))}
                />
              )}
            />
          </View>

          <DeductionSection
            value={deductions}
            onChange={changeDeductions}
            onCalculate={() => fillFromProducts(deductions, true)}
          />

          <View style={styles.section}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('addMeal.photo.title')} · {t('addMeal.photo.optional')}
            </Text>
            <PhotoField value={photo} onChange={setPhoto} />
          </View>
        </ScrollView>

        <Surface elevation={2} style={[styles.bar, { paddingBottom: spacing.md + insets.bottom }]}>
          <Button
            mode="contained"
            icon="check"
            onPress={submit}
            contentStyle={styles.submit}
            labelStyle={styles.submitLabel}>
            {Number.isFinite(kcal) && kcal > 0
              ? t('addMeal.submitSummary', { kcal: formatInt(kcal) })
              : t('addMeal.submit')}
          </Button>
        </Surface>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  section: { gap: spacing.sm },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  chips: { gap: spacing.sm },
  inputOutline: { borderRadius: radius.md },
  bar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  submit: { minHeight: 52 },
  submitLabel: { fontSize: 16 },
});
