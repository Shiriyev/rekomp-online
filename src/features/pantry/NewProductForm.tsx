import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { z } from 'zod';

import { repositories } from '@/db';
import type { Ingredient } from '@/db/schema';
import { INGREDIENT_CATEGORIES, UNITS } from '@/domain/types';
import { numberText, optionalNumberText } from '@/features/forms/numberText';
import { CATEGORY_ICONS, useCategoryLabel } from '@/features/ingredients';
import { spacing } from '@/theme';
import { NumberField } from '@/ui/NumberField';
import { useT, useTranslateMessage } from '@/i18n';

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(60, 'validation.maxLength|60'),
  category: z.enum(INGREDIENT_CATEGORIES),
  unit: z.enum(UNITS),
  gramsPerPiece: optionalNumberText({ min: 1, max: 5000 }),
  kcalPer100g: numberText({ min: 0, max: 900 }),
  proteinPer100g: numberText({ min: 0, max: 100 }),
});

type Props = {
  initialName: string;
  onCreated: (ingredient: Ingredient) => void;
  onCancel: () => void;
};

/** Minimal «новый продукт»: name, unit, kcal and protein per 100 g (+ weight of one piece). */
export function NewProductForm({ initialName, onCreated, onCancel }: Props) {
  const t = useT();
  const translate = useTranslateMessage();
  const categoryLabel = useCategoryLabel();
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialName,
      category: 'dairy',
      unit: 'g',
      gramsPerPiece: '',
      kcalPer100g: '',
      proteinPer100g: '',
    },
  });
  const unit = useWatch({ control: form.control, name: 'unit' });

  const create = () =>
    form.handleSubmit((values) => {
      if (values.unit === 'pcs' && values.gramsPerPiece === null) {
        form.setError('gramsPerPiece', { message: 'validation.pieceWeight' });
        return;
      }
      onCreated(repositories.ingredients.createCustom(values));
    })();

  return (
    <Card mode="outlined">
      <Card.Content style={styles.content}>
        <Text variant="titleMedium">{t('bulkAdd.newProductForm.title')}</Text>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <View>
              <TextInput
                mode="outlined"
                label={t('bulkAdd.newProductForm.name')}
                accessibilityLabel={t('bulkAdd.newProductForm.name')}
                value={field.value}
                onChangeText={field.onChange}
                error={!!fieldState.error}
              />
              {fieldState.error ? (
                <HelperText type="error" padding="none">
                  {translate(fieldState.error.message)}
                </HelperText>
              ) : null}
            </View>
          )}
        />
        <Controller
          control={form.control}
          name="unit"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              density="small"
              buttons={[
                { value: 'g', label: t('bulkAdd.newProductForm.grams') },
                { value: 'ml', label: t('bulkAdd.newProductForm.ml') },
                { value: 'pcs', label: t('bulkAdd.newProductForm.pieces') },
              ]}
            />
          )}
        />
        {unit === 'pcs' ? (
          <NumberField
            control={form.control}
            name="gramsPerPiece"
            label={t('bulkAdd.newProductForm.pieceWeight')}
            suffix={t('common.units.g')}
          />
        ) : null}
        <View style={styles.row}>
          <NumberField
            control={form.control}
            name="kcalPer100g"
            label={t('bulkAdd.newProductForm.kcal')}
          />
          <NumberField
            control={form.control}
            name="proteinPer100g"
            label={t('bulkAdd.newProductForm.protein')}
          />
        </View>
        <Controller
          control={form.control}
          name="category"
          render={({ field }) => (
            <View style={styles.chips}>
              {INGREDIENT_CATEGORIES.filter((c) => c !== 'spices').map((c) => (
                <Button
                  key={c}
                  compact
                  mode={field.value === c ? 'contained-tonal' : 'outlined'}
                  icon={CATEGORY_ICONS[c]}
                  onPress={() => field.onChange(c)}>
                  {categoryLabel(c)}
                </Button>
              ))}
            </View>
          )}
        />
        <View style={styles.row}>
          <Button onPress={onCancel}>{t('common.actions.cancel')}</Button>
          <Button mode="contained" style={styles.flex} onPress={create}>
            {t('bulkAdd.newProductForm.create')}
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
