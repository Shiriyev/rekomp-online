import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  IconButton,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { repositories } from '@/db';
import { useIngredientsMap } from '@/db/hooks';
import { customRecipeSchema } from '@/domain/schemas';
import { MEAL_TYPES, type MealType } from '@/domain/types';
import { MEAL_ICONS, MEAL_LABELS } from '@/features/meals';
import { ProductPickerSheet } from '@/features/pantry/ProductPickerSheet';
import { productImage } from '@/features/bundledImage';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { persistPhoto, releasePhoto } from '@/features/photos/mealPhotos';
import { PhotoField } from '@/features/photos/PhotoField';
import { showUndo } from '@/features/undo/undoStore';
import { useT, useTranslateMessage } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

type Line = { ingredientId: string; amountPerServing: number; unit: 'g' | 'ml' | 'pcs' };

const isMealType = (v: unknown): v is MealType =>
  typeof v === 'string' && (MEAL_TYPES as readonly string[]).includes(v);

/**
 * «Add your own dish»: a recipe the user writes. Saved next to the catalog dishes, so it
 * appears on its meal page and can be cooked, with its products deducted, like any other.
 * Calories and protein are not typed in — they are computed from the products, the way
 * every other dish in the app works.
 */
export default function AddDishScreen() {
  const t = useT();
  const theme = useAppTheme();
  const content = useContent();
  const translate = useTranslateMessage();
  const insets = useSafeAreaInsets();
  const ingredients = useIngredientsMap();
  const pickerRef = useRef<BottomSheetModal>(null);
  const { meal } = useLocalSearchParams<{ meal?: string }>();

  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealType>(isMealType(meal) ? meal : 'lunch');
  const [servings, setServings] = useState('2');
  const [minutes, setMinutes] = useState('30');
  const [photo, setPhoto] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);

  const input = useMemo(
    () => ({
      name,
      mealType,
      defaultServings: Number(servings) || 0,
      totalMinutes: Number(minutes) || 0,
      lines,
      steps: steps.map((s) => s.trim()).filter(Boolean),
    }),
    [name, mealType, servings, minutes, lines, steps],
  );

  const save = () => {
    const parsed = customRecipeSchema.safeParse(input);
    if (!parsed.success) {
      setError(translate(parsed.error.issues[0]?.message ?? 'validation.required'));
      return;
    }
    const stored = photo ? persistPhoto(photo) : null;
    try {
      const dish = repositories.recipes.createCustom({ ...parsed.data, photoUri: stored });
      showUndo(t('recipes.ownDish.saved', { name: dish.name }));
      router.back();
    } catch (e) {
      releasePhoto(stored);
      throw e;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('recipes.ownDish.title') }} />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled">
          <TextInput
            mode="outlined"
            label={t('recipes.ownDish.name')}
            value={name}
            onChangeText={setName}
          />

          <View style={styles.group}>
            <Text variant="labelLarge">{t('recipes.ownDish.meal')}</Text>
            <SegmentedButtons
              value={mealType}
              onValueChange={(v) => setMealType(v as MealType)}
              buttons={MEAL_TYPES.map((m) => ({
                value: m,
                label: MEAL_LABELS[m],
                icon: MEAL_ICONS[m],
              }))}
            />
          </View>

          <View style={styles.pair}>
            <TextInput
              mode="outlined"
              style={styles.flex}
              label={t('recipes.ownDish.servings')}
              keyboardType="number-pad"
              value={servings}
              onChangeText={setServings}
            />
            <TextInput
              mode="outlined"
              style={styles.flex}
              label={t('recipes.ownDish.minutes')}
              keyboardType="number-pad"
              value={minutes}
              onChangeText={setMinutes}
            />
          </View>

          <View style={styles.group}>
            <Text variant="labelLarge">{t('recipes.ownDish.products')}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('recipes.ownDish.productsHint')}
            </Text>
            {lines.map((line) => {
              const ingredient = ingredients.get(line.ingredientId);
              if (!ingredient) return null;
              return (
                <View key={line.ingredientId} style={styles.line}>
                  <ImageWithFallback
                    source={productImage(ingredient)}
                    fallbackIcon={CATEGORY_ICONS[ingredient.category]}
                    style={styles.thumb}
                    iconSize={18}
                  />
                  <Text variant="bodyLarge" style={styles.flex} numberOfLines={1}>
                    {content.ingredientName(ingredient)}
                  </Text>
                  <Text variant="bodyMedium">{formatAmount(line.amountPerServing, line.unit)}</Text>
                  <IconButton
                    icon="close"
                    size={18}
                    accessibilityLabel={t('common.actions.delete')}
                    onPress={() =>
                      setLines((prev) => prev.filter((l) => l.ingredientId !== line.ingredientId))
                    }
                  />
                </View>
              );
            })}
            <Button icon="plus" onPress={() => pickerRef.current?.present()}>
              {t('recipes.ownDish.addProduct')}
            </Button>
          </View>

          <View style={styles.group}>
            <Text variant="labelLarge">{t('recipes.ownDish.steps')}</Text>
            {steps.map((step, i) => (
              <View key={i} style={styles.line}>
                <Text variant="bodyMedium" style={styles.stepNo}>
                  {i + 1}
                </Text>
                <TextInput
                  mode="outlined"
                  dense
                  multiline
                  style={styles.flex}
                  placeholder={t('recipes.ownDish.stepPlaceholder')}
                  value={step}
                  onChangeText={(v) => setSteps((p) => p.map((s, j) => (j === i ? v : s)))}
                />
                {steps.length > 1 ? (
                  <IconButton
                    icon="close"
                    size={18}
                    accessibilityLabel={t('common.actions.delete')}
                    onPress={() => setSteps((p) => p.filter((_, j) => j !== i))}
                  />
                ) : null}
              </View>
            ))}
            <Button icon="plus" onPress={() => setSteps((p) => [...p, ''])}>
              {t('recipes.ownDish.addStep')}
            </Button>
          </View>

          <View style={styles.group}>
            <Text variant="labelLarge">{t('recipes.ownDish.photo')}</Text>
            <PhotoField value={photo} onChange={setPhoto} />
          </View>

          {error ? <HelperText type="error">{error}</HelperText> : null}

          <Button mode="contained" icon="check" onPress={save}>
            {t('recipes.ownDish.save')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      <ProductPickerSheet
        sheetRef={pickerRef}
        ingredients={[...ingredients.values()].filter(
          (i) => !lines.some((l) => l.ingredientId === i.id),
        )}
        title={t('recipes.ownDish.pickerTitle')}
        amountHint={t('recipes.ownDish.pickerHint')}
        submitLabel={t('recipes.ownDish.pickerSubmit')}
        defaultAmount={(i) => (i.unit === 'pcs' ? 1 : 100)}
        onSubmit={(ingredient, amount) =>
          setLines((prev) => [
            ...prev,
            { ingredientId: ingredient.id, amountPerServing: amount, unit: ingredient.unit },
          ])
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { padding: spacing.lg, gap: spacing.lg },
  group: { gap: spacing.sm },
  pair: { flexDirection: 'row', gap: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumb: { width: 36, height: 36, borderRadius: radius.sm },
  stepNo: { width: 18, textAlign: 'center' },
});
