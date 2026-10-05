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

import { goalMode, isBelowFloor } from '@/domain/calculator';
import { parseDecimal, PROFILE_LIMITS, type ProfileInput } from '@/domain/schemas';
import { SEXES, type GoalMode, type GoalRate } from '@/domain/types';
import { spacing, useAppTheme } from '@/theme';
import { useT, useTranslateMessage } from '@/i18n';
import { NumberField } from '@/ui/NumberField';

import {
  activityOptions,
  goalModeOptions,
  goalOptions,
  MODE_DEFAULT_RATE,
  sexLabel,
} from './labels';
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
  const t = useT();
  const translate = useTranslateMessage();
  const activities = activityOptions();
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

        <Section title={t('profile.form.about')}>
          <Controller
            control={control}
            name="sex"
            render={({ field, fieldState }) => (
              <>
                <SegmentedButtons
                  value={field.value}
                  onValueChange={field.onChange}
                  buttons={SEXES.map((s) => ({ value: s, label: sexLabel(s) }))}
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
            <NumberField
              control={control}
              name="age"
              label={t('profile.form.age')}
              suffix={t('profile.form.ageSuffix')}
              integer
            />
            <NumberField
              control={control}
              name="heightCm"
              label={t('profile.form.height')}
              suffix={t('profile.form.heightSuffix')}
            />
            <NumberField
              control={control}
              name="weightKg"
              label={t('profile.form.weight')}
              suffix={t('profile.form.weightSuffix')}
            />
          </View>
        </Section>

        <Section title={t('profile.form.activity')}>
          <Controller
            control={control}
            name="activityLevel"
            render={({ field, fieldState }) => (
              <RadioButton.Group value={field.value ?? ''} onValueChange={field.onChange}>
                {activities.map((o) => (
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

        <Section title={t('profile.form.rate')}>
          <Controller
            control={control}
            name="goalRate"
            render={({ field }) => {
              const rate = Number(field.value) as GoalRate;
              const mode = goalMode(rate);
              const options = goalOptions(mode);
              return (
                <>
                  <SegmentedButtons
                    value={mode}
                    onValueChange={(m) => field.onChange(String(MODE_DEFAULT_RATE[m as GoalMode]))}
                    buttons={goalModeOptions()}
                  />
                  {mode === 'keep' ? null : (
                    <SegmentedButtons
                      value={field.value}
                      onValueChange={field.onChange}
                      buttons={options.map((o) => ({
                        value: String(o.value),
                        label: o.label,
                        accessibilityLabel: t('profile.form.rateA11y', {
                          rate: o.label,
                          description: o.description,
                        }),
                      }))}
                    />
                  )}
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {options.find((o) => o.value === rate)?.description}
                  </Text>
                </>
              );
            }}
          />
        </Section>

        <Section title={t('profile.form.targets')}>
          <Controller
            control={control}
            name="mode"
            render={({ field }) => (
              <SegmentedButtons
                value={field.value}
                onValueChange={field.onChange}
                buttons={[
                  { value: 'calculate', label: t('profile.form.calculate') },
                  { value: 'manual', label: t('profile.form.manual') },
                ]}
              />
            )}
          />
          {v.mode === 'manual' ? (
            <>
              <NumberField
                control={control}
                name="kcalTarget"
                label={t('profile.form.kcal')}
                suffix={t('common.kcal')}
                integer
              />
              <View style={styles.row}>
                <NumberField
                  control={control}
                  name="proteinTargetG"
                  label={t('profile.form.proteinTarget')}
                  suffix={t('common.grams')}
                  integer
                />
                <NumberField
                  control={control}
                  name="proteinMinG"
                  label={t('profile.form.proteinMin')}
                  suffix={t('common.grams')}
                  integer
                />
              </View>
              {validBody && Number.isFinite(manualKcal) && isBelowFloor(manualKcal, validBody) ? (
                <Text variant="bodyMedium" style={{ color: theme.colors.warning }}>
                  {t('profile.form.belowFloor')}
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
              {t('profile.form.fillFirst')}
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
