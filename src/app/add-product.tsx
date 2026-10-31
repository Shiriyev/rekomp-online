import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { repositories } from '@/db';
import type { CustomIngredientInput } from '@/domain/schemas';
import { INGREDIENT_CATEGORIES, SHOPS, UNITS } from '@/domain/types';
import { useCategoryLabel } from '@/features/ingredients';
import {
  customProductFormSchema,
  type CustomProductFormValues,
} from '@/features/pantry/customProductSchema';
import { persistPhoto, releasePhoto } from '@/features/photos/mealPhotos';
import { PhotoField } from '@/features/photos/PhotoField';
import { SHOP_LABELS } from '@/features/shops';
import { showUndo } from '@/features/undo/undoStore';
import { useT, useTranslateMessage } from '@/i18n';
import { spacing } from '@/theme';
import { NumberField } from '@/ui/NumberField';

/**
 * «Add your own product»: a product the catalog does not have. It is saved to the catalog
 * as the user's own, so it is picked from a list next time instead of typed again.
 */
export default function AddProductScreen() {
  const t = useT();
  const translate = useTranslateMessage();
  const categoryLabel = useCategoryLabel();
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<
    CustomProductFormValues,
    unknown,
    CustomIngredientInput
  >({
    defaultValues: {
      name: '',
      category: 'other',
      unit: 'g',
      gramsPerPiece: '',
      kcalPer100g: '',
      proteinPer100g: '',
      shops: [],
      photoUri: null,
    },
    resolver: zodResolver(customProductFormSchema),
  });
  const unit = useWatch({ control, name: 'unit' });

  const submit = () =>
    void handleSubmit((values) => {
      // The picked file sits in the cache until the product is actually saved.
      const stored = photo ? persistPhoto(photo) : null;
      try {
        const product = repositories.ingredients.createCustom({ ...values, photoUri: stored });
        showUndo(t('pantry.ownProduct.saved', { name: product.name }));
        router.back();
      } catch (error) {
        releasePhoto(stored);
        throw error;
      }
    })();

  const error = (key: keyof CustomProductFormValues) => {
    const message = formState.errors[key]?.message;
    return message ? translate(message) : null;
  };

  return (
    <>
      <Stack.Screen options={{ title: t('pantry.ownProduct.title') }} />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled">
          <Text variant="bodyMedium">{t('pantry.ownProduct.hint')}</Text>

          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <View>
                <TextInput
                  mode="outlined"
                  label={t('pantry.ownProduct.name')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={!!error('name')}
                />
                {error('name') ? <HelperText type="error">{error('name')}</HelperText> : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="unit"
            render={({ field }) => (
              <View style={styles.group}>
                <Text variant="labelLarge">{t('pantry.ownProduct.unit')}</Text>
                <SegmentedButtons
                  value={field.value}
                  onValueChange={field.onChange}
                  buttons={UNITS.map((u) => ({ value: u, label: t(`common.units.${u}`) }))}
                />
              </View>
            )}
          />

          {unit === 'pcs' ? (
            <NumberField
              control={control}
              name="gramsPerPiece"
              label={t('pantry.ownProduct.pieceWeight')}
              suffix={t('common.units.g')}
            />
          ) : null}

          <View style={styles.pair}>
            <View style={styles.flex}>
              <NumberField
                control={control}
                name="kcalPer100g"
                label={t('pantry.ownProduct.kcal')}
              />
            </View>
            <View style={styles.flex}>
              <NumberField
                control={control}
                name="proteinPer100g"
                label={t('pantry.ownProduct.protein')}
                suffix={t('common.units.g')}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <View style={styles.group}>
                <Text variant="labelLarge">{t('pantry.ownProduct.category')}</Text>
                <View style={styles.chips}>
                  {INGREDIENT_CATEGORIES.map((c) => (
                    <Chip
                      key={c}
                      compact
                      selected={field.value === c}
                      showSelectedCheck={false}
                      onPress={() => field.onChange(c)}>
                      {categoryLabel(c)}
                    </Chip>
                  ))}
                </View>
              </View>
            )}
          />

          <Controller
            control={control}
            name="shops"
            render={({ field }) => (
              <View style={styles.group}>
                <Text variant="labelLarge">{t('pantry.ownProduct.shops')}</Text>
                <Text variant="bodySmall">{t('pantry.ownProduct.shopsHint')}</Text>
                <View style={styles.chips}>
                  {SHOPS.map((s) => (
                    <Chip
                      key={s}
                      compact
                      selected={field.value.includes(s)}
                      showSelectedCheck={false}
                      onPress={() =>
                        field.onChange(
                          field.value.includes(s)
                            ? field.value.filter((x) => x !== s)
                            : [...field.value, s],
                        )
                      }>
                      {SHOP_LABELS[s]}
                    </Chip>
                  ))}
                </View>
              </View>
            )}
          />

          <View style={styles.group}>
            <Text variant="labelLarge">{t('pantry.ownProduct.photo')}</Text>
            <PhotoField value={photo} onChange={setPhoto} />
          </View>

          <Button mode="contained" icon="check" onPress={submit} style={styles.save}>
            {t('pantry.ownProduct.save')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: spacing.lg, gap: spacing.lg },
  group: { gap: spacing.sm },
  pair: { flexDirection: 'row', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  save: { marginTop: spacing.sm },
});
