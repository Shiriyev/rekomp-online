import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  Portal,
  SegmentedButtons,
  Snackbar,
  Text,
} from 'react-native-paper';

import { repositories } from '@/db';
import { useActiveSales, useIngredientsMap, usePantryStock, useRecipeDetail } from '@/db/hooks';
import { recipeMacros } from '@/domain/nutrition';
import { autoChoices, canCook } from '@/domain/pantry';
import { RECIPE_IMAGES } from '@/features/images';
import { MEAL_ICONS, MEAL_LABELS } from '@/features/meals';
import { IngredientRow } from '@/features/recipes/IngredientRow';
import { StatusBadge } from '@/features/recipes/StatusBadge';
import { useKcalLeftToday } from '@/features/recipes/useKcalLeftToday';
import { formatAmount, formatInt, formatKcal } from '@/lib/format';
import { useClock } from '@/lib/useClock';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

const SERVING_OPTIONS = [1, 2, 3, 4] as const;

export default function RecipeScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, lines, isLoaded } = useRecipeDetail(id);
  const ingredients = useIngredientsMap();
  const pantry = usePantryStock();
  const { today } = useClock();
  const sales = useActiveSales(today);
  const kcalLeft = useKcalLeftToday();

  const [servingsOverride, setServings] = useState<number | null>(null);
  const [userChoices, setUserChoices] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const servings = servingsOverride ?? recipe?.defaultServings ?? 1;

  const computed = useMemo(() => {
    if (!recipe || ingredients.size === 0 || lines.length === 0) return null;
    const choices = { ...autoChoices(lines, ingredients, pantry, servings), ...userChoices };
    const check = canCook(lines, ingredients, pantry, servings, choices);
    const macros = recipeMacros(lines, ingredients, { servings, choices });
    const staples = lines
      .map((l) => ingredients.get(l.ingredientId))
      .filter((i) => i?.isStaple)
      .map((i) => i!.name.toLocaleLowerCase('ru-RU'));
    return { check, macros, staples };
  }, [recipe, lines, ingredients, pantry, servings, userChoices]);

  if (isLoaded && !recipe) {
    return <EmptyState icon="alert-circle-outline" title="Блюдо не найдено" />;
  }
  if (!recipe || !computed) return null;

  const { check, macros, staples } = computed;
  const perServing = macros.perServing;
  const after = kcalLeft - perServing.kcal;

  const startCooking = () => {
    setConfirmOpen(false);
    router.push({ pathname: '/cook/[id]', params: { id: recipe.id, servings: String(servings) } });
  };

  const addMissing = () => {
    const n = repositories.shopping.addMissing(check.missing);
    setMessage(n > 0 ? `В список покупок: ${n}` : 'Уже в списке покупок');
  };

  return (
    <>
      <Stack.Screen options={{ title: MEAL_LABELS[recipe.mealType] }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ImageWithFallback
          source={recipe.imageKey ? RECIPE_IMAGES[recipe.imageKey] : undefined}
          fallbackIcon={MEAL_ICONS[recipe.mealType]}
          style={styles.hero}
          iconSize={72}
          accessibilityLabel={recipe.name}
        />

        <View style={styles.section}>
          <Text variant="headlineSmall" accessibilityRole="header">
            {recipe.name}
          </Text>
          <View style={styles.chips}>
            <Chip compact icon="clock-outline">
              {recipe.totalMinutes} мин
            </Chip>
            {recipe.prepNightBefore ? (
              <Chip compact icon="weather-night">
                С вечера
              </Chip>
            ) : null}
            {recipe.tags
              .filter((t) => t !== 'с вечера')
              .map((t) => (
                <Chip compact key={t}>
                  {t}
                </Chip>
              ))}
          </View>
        </View>

        <Card
          mode="contained"
          style={[styles.inset, { backgroundColor: theme.colors.primaryContainer }]}>
          <Card.Content style={styles.macros}>
            <View>
              <Text variant="headlineMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                {formatKcal(perServing.kcal)}
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                {formatInt(perServing.protein)} г белка
              </Text>
            </View>
            <View style={styles.macrosRight}>
              <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                на порцию
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: after < 0 ? theme.colors.error : theme.colors.onPrimaryContainer }}>
                {after < 0
                  ? `перебор ${formatInt(-after)} ккал`
                  : `останется ${formatInt(after)} ккал`}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {recipe.isBatch ? (
          <View style={styles.section}>
            <Text variant="titleMedium">Порций в кастрюле</Text>
            <SegmentedButtons
              value={String(servings)}
              onValueChange={(v) => setServings(Number(v))}
              buttons={SERVING_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Всего {formatKcal(macros.total.kcal)}, {formatInt(macros.total.protein)} г белка
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.titleRow}>
            <Text variant="titleMedium" accessibilityRole="header">
              Продукты{recipe.isBatch ? ` на ${servings}` : ''}
            </Text>
            <StatusBadge check={check} />
          </View>
          {check.lines.map((c, index) => {
            const ingredient = ingredients.get(c.line.ingredientId);
            if (!ingredient) return null;
            return (
              <View key={c.line.ingredientId}>
                {index > 0 ? <Divider /> : null}
                <IngredientRow
                  check={c}
                  ingredient={ingredient}
                  alternatives={c.alternatives.flatMap((a) => ingredients.get(a) ?? [])}
                  sale={sales.get(c.line.ingredientId)}
                  servings={servings}
                  onChooseAlternative={(altId) => {
                    const group = c.line.altGroup;
                    if (group) setUserChoices((prev) => ({ ...prev, [group]: altId }));
                  }}
                />
              </View>
            );
          })}
          {staples.length > 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Специи по вкусу: {staples.join(', ')}
            </Text>
          ) : null}
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            КБЖУ ориентировочные — проверь по этикетке.
          </Text>
        </View>

        <View style={styles.actions}>
          {check.missing.length > 0 ? (
            <Button
              mode="outlined"
              icon="cart-plus"
              onPress={addMissing}
              contentStyle={styles.button}>
              Добавить недостающее в список
            </Button>
          ) : null}
          <Button
            mode="contained"
            icon="chef-hat"
            onPress={() => (check.status === 'ok' ? startCooking() : setConfirmOpen(true))}
            contentStyle={styles.button}>
            Начать готовить
          </Button>
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={confirmOpen} onDismiss={() => setConfirmOpen(false)}>
          <Dialog.Title>Не всё есть дома</Dialog.Title>
          <Dialog.Content style={styles.dialog}>
            {check.missing.map((m) => (
              <Text key={m.ingredientId} variant="bodyMedium">
                • {ingredients.get(m.ingredientId)?.name}: не хватает{' '}
                {formatAmount(m.amount, m.unit)}
              </Text>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmOpen(false)}>Отмена</Button>
            <Button mode="contained" onPress={startCooking}>
              Всё равно начать
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={3000}>
        {message}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: { width: '100%', height: 220 },
  section: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  inset: { marginHorizontal: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  macros: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  macrosRight: { alignItems: 'flex-end', gap: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { paddingHorizontal: spacing.lg, gap: spacing.md },
  button: { minHeight: 52 },
  dialog: { gap: spacing.xs },
});
