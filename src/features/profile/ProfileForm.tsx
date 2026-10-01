import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  RadioButton,
  SegmentedButtons,
  Text,
  TouchableRipple,
} from 'react-native-paper';

import { isBelowFloor } from '@/domain/calculator';
import { parseDecimal, PROFILE_LIMITS, type ProfileInput } from '@/domain/schemas';
import { SEXES, type GoalRate } from '@/domain/types';
import { spacing, useAppTheme } from '@/theme';
import { useTranslateMessage } from '@/i18n';
import { NumberField } from '@/ui/NumberField';

import { ACTIVITY_OPTIONS, GOAL_OPTIONS, SEX_LABELS } from './labels';
import { profileFormSchema, type ProfileFormValues } from './profileFormSchema';
import { TargetsPreview } from './TargetsPreview';

type Props = {
  defaultValues: ProfileFormValues;
  submitLabel: string;
  onSubmit: (profile: ProfileInput) => void;
  header?: React.ReactNode;
};

const inRange = (n: number, { min, max }: { min: number; max: number }) => n >= min && n <= max;

export function ProfileForm({ defaultValues, submitLabel, onSubmit, header }: Props) {
  const theme = useAppTheme();
  const translate = useTranslateMessage();
  const { control, handleSubmit, formState } = useForm<ProfileFormValues, unknown, ProfileInput>({
    defaultValues,
    resolver: zodResolver(profileFormSchema),
    mode: 'onTouched',
  });
  const v = useWatch({ control });

  const body = {
    sex: v.sex,
    age: parseDecimal(v.age ?? ''),
    heightCm: parseDecimal(v.heightCm ?? ''),
    weightKg: parseDecimal(v.weightKg ?? ''),
  };
  const bodyValid =
    (body.sex === 'male' || body.sex === 'female') &&
    inRange(body.age, PROFILE_LIMITS.age) &&
    inRange(body.heightCm, PROFILE_LIMITS.heightCm) &&
    inRange(body.weightKg, PROFILE_LIMITS.weightKg);
  const validBody = bodyValid ? { ...body, sex: body.sex as (typeof SEXES)[number] } : null;
  const manualKcal = parseDecimal(v.kcalTarget ?? '');

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {header}

        <Section title="О тебе">
          <Controller
            control={control}
            name="sex"
            render={({ field, fieldState }) => (
              <>
                <SegmentedButtons
                  value={field.value}
                  onValueChange={field.onChange}
                  buttons={SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))}
                />
                {fieldState.error ? (
                  <HelperText type="error" padding="none">
                    {translate(fieldState.error.message)}
                  </HelperText>
                ) : null}
              </>
            )}
          />
          <View style={styles.row}>
            <NumberField control={control} name="age" label="Возраст" suffix="лет" integer />
            <NumberField control={control} name="heightCm" label="Рост" suffix="см" />
            <NumberField control={control} name="weightKg" label="Вес" suffix="кг" />
          </View>
        </Section>

        <Section title="Активность">
          <Controller
            control={control}
            name="activityLevel"
            render={({ field, fieldState }) => (
              <RadioButton.Group value={field.value ?? ''} onValueChange={field.onChange}>
                {ACTIVITY_OPTIONS.map((o) => (
                  <TouchableRipple
                    key={o.value}
                    onPress={() => field.onChange(o.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: field.value === o.value }}
                    accessibilityLabel={`${o.title}. ${o.description}`}
                    style={styles.option}>
                    <View style={styles.optionRow}>
                      <RadioButton value={o.value} />
                      <View style={styles.flex}>
                        <Text variant="titleSmall">{o.title}</Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {o.description}
                        </Text>
                        {o.hint ? (
                          <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                            {o.hint}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </TouchableRipple>
                ))}
                {fieldState.error ? (
                  <HelperText type="error" padding="none">
                    {translate(fieldState.error.message)}
                  </HelperText>
                ) : null}
              </RadioButton.Group>
            )}
          />
        </Section>

        <Section title="Темп, кг в неделю">
          <Controller
            control={control}
            name="goalRate"
            render={({ field }) => (
              <>
                <SegmentedButtons
                  value={field.value}
                  onValueChange={field.onChange}
                  buttons={GOAL_OPTIONS.map((o) => ({
                    value: String(o.value),
                    label: o.label,
                    accessibilityLabel: `${o.label} кг в неделю, ${o.description}`,
                  }))}
                />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {GOAL_OPTIONS.find((o) => String(o.value) === field.value)?.description}
                </Text>
              </>
            )}
          />
        </Section>

        <Section title="Цели">
          <Controller
            control={control}
            name="mode"
            render={({ field }) => (
              <SegmentedButtons
                value={field.value}
                onValueChange={field.onChange}
                buttons={[
                  { value: 'calculate', label: 'Рассчитать' },
                  { value: 'manual', label: 'Свои значения' },
                ]}
              />
            )}
          />
          {v.mode === 'manual' ? (
            <>
              <NumberField
                control={control}
                name="kcalTarget"
                label="Калории"
                suffix="ккал"
                integer
              />
              <View style={styles.row}>
                <NumberField
                  control={control}
                  name="proteinTargetG"
                  label="Белок, цель"
                  suffix="г"
                  integer
                />
                <NumberField
                  control={control}
                  name="proteinMinG"
                  label="Белок, минимум"
                  suffix="г"
                  integer
                />
              </View>
              {validBody && Number.isFinite(manualKcal) && isBelowFloor(manualKcal, validBody) ? (
                <Text variant="bodyMedium" style={{ color: theme.colors.warning }}>
                  Это ниже безопасного минимума для твоих данных. Так можно, но долго держать такую
                  цель не стоит.
                </Text>
              ) : null}
            </>
          ) : validBody && v.activityLevel ? (
            <TargetsPreview
              body={validBody}
              activityLevel={v.activityLevel}
              goalRate={Number(v.goalRate) as GoalRate}
            />
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Заполни данные и активность — здесь появится расчёт.
            </Text>
          )}
        </Section>

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={formState.isSubmitting}
          contentStyle={styles.submit}>
          {submitLabel}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="titleMedium" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  option: { borderRadius: 12, paddingVertical: spacing.xs, minHeight: 48 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  submit: { minHeight: 52 },
});
