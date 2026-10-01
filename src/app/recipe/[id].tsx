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
import { recipeMacros, resolveLines, roundKcal, roundProtein } from '@/domain/nutrition';
import { autoChoices, canCook } from '@/domain/pantry';
import { applyAmounts, draftStep, isRemoved } from '@/domain/recipeDraft';
import { RECIPE_IMAGES } from '@/features/images';
import { MEAL_ICONS, MEAL_LABELS } from '@/features/meals';
import { IngredientRow } from '@/features/recipes/IngredientRow';
import {
  clearRecipeDraft,
  useRecipeDraft,
  useRecipeDraftStore,
} from '@/features/recipes/recipeDraftStore';
import { StatusBadge } from '@/features/recipes/StatusBadge';
import { useKcalLeftToday } from '@/features/recipes/useKcalLeftToday';
import { formatAmount, formatInt, formatKcal } from '@/lib/format';
import { useClock } from '@/lib/useClock';
import { showUndo } from '@/features/undo/undoStore';
import { spacing, useAppTheme } from '@/theme';
import { AmountInput } from '@/ui/AmountInput';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';
import { SkeletonDetail } from '@/ui/Skeleton';

const SERVING_OPTIONS = [1, 2, 3, 4] as const;

export default function RecipeScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, lines, hasCustom, isLoaded } = useRecipeDetail(id);
  const draft = useRecipeDraft(id);
  const setDraftAmount = useRecipeDraftStore((s) => s.setAmount);
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
    // The card edits a draft of this cook: status, macros and shopping use the drafted amounts.
    const drafted = applyAmounts(lines, draft);
    const choices = { ...autoChoices(drafted, ingredients, pantry, servings), ...userChoices };
    const check = canCook(drafted, ingredients, pantry, servings, choices);
    const macros = recipeMacros(drafted, ingredients, { servings, choices });
    const baseMacros = recipeMacros(lines, ingredients, { servings, choices });
    const used = resolveLines(drafted, choices).filter(
      (l) => !ingredients.get(l.ingredientId)?.isStaple,
    );
    const staples = lines
      .map((l) => ingredients.get(l.ingredientId))
      .filter((i) => i?.isStaple)
      .map((i) => i!.name.toLocaleLowerCase('ru-RU'));
    return { check, macros, baseMacros, used, staples };
  }, [recipe, lines, draft, ingredients, pantry, servings, userChoices]);

  if (isLoaded && !recipe) {
    return <EmptyState icon="alert-circle-outline" title="Блюдо не найдено" />;
  }
  if (!recipe || !computed) return <SkeletonDetail />;

  const { check, macros, baseMacros, used, staples } = computed;
  const perServing = macros.perServing;
  const after = kcalLeft - perServing.kcal;
  const drafted = Object.keys(draft).length > 0;
  const kcalChanged = roundKcal(perServing.kcal) !== roundKcal(baseMacros.perServing.kcal);
  const proteinChanged =
    roundProtein(perServing.protein) !== roundProtein(baseMacros.perServing.protein);
  const baseAmountOf = (ingredientId: string) =>
    lines.find((l) => l.ingredientId === ingredientId)?.amountPerServing ?? 0;

  const startCooking = () => {
    setConfirmOpen(false);
    router.push({
      pathname: '/cook/[id]',
      // fromCard: the cook takes the card's (possibly edited) amounts.
      params: {
        id: recipe.id,
        servings: String(servings),
        choices: JSON.stringify(check.choices),
        fromCard: '1',
      },
    });
  };

  const justAte = () => {
    // One portion eaten without the cooking mode; products for that portion are deducted.
    const result = repositories.cook.quickEat(
      recipe.id,
      1,
      check.choices,
      recipe.mealType,
      Date.now(),
      draft,
    );
    clearRecipeDraft(recipe.id);
    showUndo(`Записано: ${recipe.name}`, () => repositories.cook.undo(result.sessionId));
    router.back();
  };

  const saveAsMine = () => {
    repositories.recipes.saveCustomAmounts(recipe.id, applyAmountsMap(lines, draft));
    clearRecipeDraft(recipe.id);
    setMessage('Сохранено как твоя версия рецепта');
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
              <Text
                variant="headlineMedium"
                style={{ color: theme.colors.onPrimaryContainer }}
                accessibilityLabel={
                  kcalChanged
                    ? `${formatInt(perServing.kcal)} ккал, в рецепте ${formatInt(baseMacros.perServing.kcal)}`
                    : undefined
                }>
                {kcalChanged
                  ? `${formatInt(baseMacros.perServing.kcal)} → ${formatKcal(perServing.kcal)}`
                  : formatKcal(perServing.kcal)}
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                {proteinChanged
                  ? `${formatInt(baseMacros.perServing.protein)} → ${formatInt(perServing.protein)} г белка`
                  : `${formatInt(perServing.protein)} г белка`}
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
          {used.map((line, index) => {
            const ingredient = ingredients.get(line.ingredientId);
            if (!ingredient) return null;
            const base = baseAmountOf(line.ingredientId);
            const changed = Math.abs(line.amountPerServing - base) > 1e-9;
            const stepper = (
              <View style={styles.editor}>
                <Text
                  variant="bodySmall"
                  style={[
                    styles.flex,
                    { color: changed ? theme.colors.primary : theme.colors.onSurfaceVariant },
                  ]}>
                  {servings > 1
                    ? `${formatAmount(line.amountPerServing, line.unit)}/порц · ${formatAmount(line.amountPerServing * servings, line.unit)} всего`
                    : `${formatAmount(line.amountPerServing, line.unit)} на порцию`}
                  {changed ? ` (в рецепте ${formatAmount(base, line.unit)})` : ''}
                </Text>
                <AmountInput
                  label={ingredient.name}
                  value={line.amountPerServing}
                  onChange={(n) => setDraftAmount(recipe.id, line.ingredientId, n, base, line.unit)}
                  unit={line.unit}
                  step={draftStep(line.unit)}
                />
              </View>
            );
            if (isRemoved(line)) {
              return (
                <View key={line.ingredientId} style={styles.removed}>
                  {index > 0 ? <Divider /> : null}
                  <View style={styles.removedRow}>
                    <Text
                      variant="bodyLarge"
                      style={[
                        styles.flex,
                        styles.strike,
                        { color: theme.colors.onSurfaceDisabled },
                      ]}>
                      {ingredient.name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceDisabled }}>
                      убрано
                    </Text>
                    <Button
                      compact
                      icon="undo"
                      onPress={() =>
                        setDraftAmount(recipe.id, line.ingredientId, base, base, line.unit)
                      }
                      accessibilityLabel={`Вернуть ${ingredient.name}`}>
                      Вернуть
                    </Button>
                  </View>
                </View>
              );
            }
            const c = check.lines.find((l) => l.line.ingredientId === line.ingredientId);
            if (!c) return null;
            return (
              <View key={line.ingredientId}>
                {index > 0 ? <Divider /> : null}
                <IngredientRow
                  check={c}
                  ingredient={ingredient}
                  alternatives={c.alternatives.flatMap((a) => ingredients.get(a) ?? [])}
                  sale={sales.get(c.line.ingredientId)}
                  servings={servings}
                  changed={changed}
                  onChooseAlternative={(altId) => {
                    const group = c.line.altGroup;
                    if (group) setUserChoices((prev) => ({ ...prev, [group]: altId }));
                  }}
                  footer={stepper}
                />
              </View>
            );
          })}
          {drafted || hasCustom ? (
            <View style={styles.draftActions}>
              {drafted ? (
                <Button icon="restore" onPress={() => clearRecipeDraft(recipe.id)}>
                  Сбросить к рецепту
                </Button>
              ) : null}
              {drafted ? (
                <Button icon="content-save-outline" onPress={saveAsMine}>
                  Сохранить как мою версию
                </Button>
              ) : null}
              {!drafted && hasCustom ? (
                <Button
                  icon="history"
                  onPress={() => {
                    repositories.recipes.resetCustomAmounts(recipe.id);
                    setMessage('Вернули исходные количества');
                  }}>
                  Вернуть исходный рецепт
                </Button>
              ) : null}
            </View>
          ) : null}
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
          <Button
            mode="text"
            icon="silverware-fork-knife"
            onPress={justAte}
            contentStyle={styles.button}>
            Просто съел(а)
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
  flex: { flex: 1 },
  editor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 60 },
  removed: { opacity: 0.8 },
  removedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 },
  strike: { textDecorationLine: 'line-through' },
  draftActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

/** The full per-serving amounts the card currently shows. */
const applyAmountsMap = (
  lines: readonly { ingredientId: string; amountPerServing: number }[],
  draft: Readonly<Record<string, number>>,
): Record<string, number> =>
  Object.fromEntries(
    lines.map((l) => [l.ingredientId, draft[l.ingredientId] ?? l.amountPerServing]),
  );
