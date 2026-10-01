import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Vibration, View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  IconButton,
  Portal,
  ProgressBar,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { repositories } from '@/db';
import { useCookView, useIngredientsMap, useIsFirstCook, useRecipeDetail } from '@/db/hooks';
import { formatTimer, isDone, remainingSec, stepIngredients } from '@/domain/cooking';
import { recipeMacros, roundKcal, roundProtein } from '@/domain/nutrition';
import { applyAmounts } from '@/domain/recipeDraft';
import { activeTimers, useCookStore } from '@/features/cooking/cookStore';
import { FinishView } from '@/features/cooking/FinishView';
import { RecipeOverview } from '@/features/cooking/RecipeOverview';
import { TimerCard } from '@/features/cooking/TimerCard';
import { clearRecipeDraft, useRecipeDraftStore } from '@/features/recipes/recipeDraftStore';
import { showUndo } from '@/features/undo/undoStore';
import { formatAmount, formatInt } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';

const parseChoices = (raw: string | undefined): Record<string, string> => {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string'),
      );
    }
  } catch {
    // Ignore malformed params and fall back to defaults.
  }
  return {};
};

const parseServings = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : fallback;
};

export default function CookScreen() {
  useKeepAwake();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{
    id: string;
    servings?: string;
    choices?: string;
    fromCard?: string;
  }>();
  const { recipe, lines: recipeLines, steps, isLoaded } = useRecipeDetail(params.id);
  const ingredients = useIngredientsMap();
  const firstTime = useIsFirstCook(params.id);

  const session = useCookStore((s) => s.session);
  const progress = useCookStore((s) => s.progress);
  const conflict = useCookStore((s) => s.conflict);
  const store = useCookStore.getState;
  const [exitOpen, setExitOpen] = useState(false);
  const view = useCookView();

  // Open or resume the session once the recipe is known.
  const defaultServings = recipe?.defaultServings;
  useEffect(() => {
    if (defaultServings === undefined) return;
    const draft =
      params.fromCard === '1' ? (useRecipeDraftStore.getState().drafts[params.id] ?? {}) : null;
    store().open(
      params.id,
      parseServings(params.servings, defaultServings),
      parseChoices(params.choices),
      draft,
    );
  }, [params.id, params.servings, params.choices, params.fromCard, defaultServings, store]);

  useEffect(() => {
    store().setScreenOpen(true);
    return () => store().setScreenOpen(false);
  }, [store]);

  // Android back asks before leaving.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setExitOpen(true);
      return true;
    });
    return () => sub.remove();
  }, []);

  const now = useNow(
    500,
    progress.timers.some((t) => t.startedAt !== null),
  );
  const runningTimers = activeTimers(progress.timers, now);

  // Alert once per timer when it reaches zero while the screen is open.
  const alerted = useRef(new Set<string>());
  useEffect(() => {
    for (const t of progress.timers) {
      const key = `${t.stepOrder}:${t.startedAt}`;
      if (t.startedAt !== null && isDone(t, now) && !alerted.current.has(key)) {
        alerted.current.add(key);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate([0, 400, 200, 400]);
      }
    }
  }, [now, progress.timers]);

  const servings = session?.servings ?? recipe?.defaultServings ?? 1;
  const choices = useMemo(() => session?.choices ?? {}, [session?.choices]);
  // The cooked amounts (edited on the card) drive steps, macros and the deduction.
  const lines = useMemo(
    () => applyAmounts(recipeLines, session?.amounts ?? {}),
    [recipeLines, session?.amounts],
  );
  const perPortion = useMemo(() => {
    if (ingredients.size === 0 || lines.length === 0) return { kcal: 0, protein: 0 };
    const m = recipeMacros(lines, ingredients, { choices }).perServing;
    return { kcal: roundKcal(m.kcal), protein: roundProtein(m.protein) };
  }, [lines, ingredients, choices]);

  if (isLoaded && !recipe)
    return <EmptyState icon="alert-circle-outline" title="Блюдо не найдено" />;
  if (!recipe || steps.length === 0) return null;

  const stepIndex = Math.min(progress.stepIndex, steps.length);
  const finished = stepIndex >= steps.length;
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;
  const used = stepIngredients(step.ingredientRefs, lines, ingredients, servings, choices);

  const go = (index: number) => {
    const next = Math.max(0, Math.min(index, steps.length));
    if (next > stepIndex) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store().setStep(next);
  };

  const swipe = Gesture.Exclusive(
    Gesture.Fling()
      .direction(Directions.LEFT)
      .runOnJS(true)
      .onEnd(() => !finished && go(stepIndex + 1)),
    Gesture.Fling()
      .direction(Directions.RIGHT)
      .runOnJS(true)
      .onEnd(() => go(stepIndex - 1)),
  );

  const complete = (eatNow: boolean) => {
    // A cooked dish counts toward its own meal (breakfast recipe → breakfast).
    const result = store().finish({ eatNow, mealType: recipe.mealType });
    if (!result) return;
    clearRecipeDraft(recipe.id);
    showUndo(
      eatNow
        ? `Записано: +${formatInt(result.perPortion.kcal)} ккал, +${formatInt(result.perPortion.protein)} г белка`
        : `В холодильнике: ${result.stored} порц.`,
      () => {
        try {
          repositories.cook.undo(result.sessionId);
        } catch {
          showUndo('Отменить нельзя: порции уже съедены');
        }
      },
    );
    router.dismissTo('/');
  };

  const timerLabel = `${recipe.name}: шаг ${step.order}`;
  const otherTimers = runningTimers.filter((t) => t.stepOrder !== step.order);

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <IconButton
          icon="close"
          onPress={() => setExitOpen(true)}
          accessibilityLabel="Выйти из готовки"
        />
        <View style={styles.flex}>
          <Text variant="labelLarge" numberOfLines={1}>
            {recipe.name}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {finished ? 'Все шаги пройдены' : `Шаг ${stepIndex + 1} из ${steps.length}`}
          </Text>
        </View>
      </View>
      <ProgressBar
        progress={stepIndex / steps.length}
        color={theme.colors.primary}
        style={styles.progress}
      />
      {finished ? null : (
        <SegmentedButtons
          value={view}
          onValueChange={(v) =>
            repositories.settings.setCookView(v === 'overview' ? 'overview' : 'steps')
          }
          density="small"
          style={styles.viewSwitch}
          buttons={[
            { value: 'steps', label: 'По шагам', icon: 'format-list-numbered' },
            { value: 'overview', label: 'Весь рецепт', icon: 'text-long' },
          ]}
        />
      )}

      {otherTimers.length > 0 ? (
        <View style={styles.otherTimers}>
          {otherTimers.map((t) => (
            <Chip
              key={t.stepOrder}
              icon={isDone(t, now) ? 'bell-ring' : 'timer-outline'}
              onPress={() => {
                // Timers live on their steps: jump there in the step-by-step view.
                repositories.settings.setCookView('steps');
                go(steps.findIndex((s) => s.order === t.stepOrder));
              }}
              accessibilityLabel={`Таймер шага ${t.stepOrder}`}>
              Шаг {t.stepOrder}: {isDone(t, now) ? 'готово' : formatTimer(remainingSec(t, now))}
            </Chip>
          ))}
        </View>
      ) : null}

      {finished ? (
        <FinishView
          recipeName={recipe.name}
          perPortion={perPortion}
          servings={servings}
          isBatch={recipe.isBatch}
          firstTime={firstTime}
          onEatNow={() => complete(true)}
          onStoreAll={() => complete(false)}
          onBack={() => go(steps.length - 1)}
        />
      ) : view === 'overview' ? (
        <RecipeOverview
          steps={steps}
          lines={lines}
          ingredients={ingredients}
          servings={servings}
          choices={choices}
          onFinish={() => go(steps.length)}
        />
      ) : (
        <>
          <GestureDetector gesture={swipe}>
            <ScrollView contentContainerStyle={styles.body}>
              <Text variant="headlineSmall" style={styles.stepText}>
                {step.text}
              </Text>

              {used.length > 0 ? (
                <View style={styles.ingredients}>
                  {used.map((u) => {
                    const key = `${step.order}:${u.ingredientId}`;
                    const name = ingredients.get(u.ingredientId)?.name ?? u.ingredientId;
                    const amount = u.amount === null ? 'по вкусу' : formatAmount(u.amount, u.unit);
                    return (
                      <Checkbox.Item
                        key={key}
                        label={`${name} — ${amount}`}
                        status={progress.checked.includes(key) ? 'checked' : 'unchecked'}
                        onPress={() => store().toggleChecked(key)}
                        position="leading"
                        labelVariant="titleMedium"
                        labelStyle={styles.checkboxLabel}
                        style={styles.checkbox}
                      />
                    );
                  })}
                </View>
              ) : null}

              {step.timerSec ? (
                <TimerCard
                  durationSec={step.timerSec}
                  timer={progress.timers.find((t) => t.stepOrder === step.order)}
                  now={now}
                  onStart={() => store().startTimer(step.order, step.timerSec!, timerLabel)}
                  onPause={() => store().pauseTimer(step.order)}
                  onReset={() => store().resetTimer(step.order)}
                />
              ) : null}
            </ScrollView>
          </GestureDetector>

          <View style={styles.nav}>
            <Button
              mode="outlined"
              icon="arrow-left"
              disabled={stepIndex === 0}
              onPress={() => go(stepIndex - 1)}
              contentStyle={styles.big}
              style={styles.flex}>
              Назад
            </Button>
            <Button
              mode="contained"
              icon={stepIndex === steps.length - 1 ? 'check' : 'arrow-right'}
              contentStyle={[styles.big, styles.reverse]}
              onPress={() => go(stepIndex + 1)}
              style={styles.flex}>
              {stepIndex === steps.length - 1 ? 'Готово' : 'Дальше'}
            </Button>
          </View>
        </>
      )}

      <Portal>
        <Dialog visible={exitOpen} onDismiss={() => setExitOpen(false)}>
          <Dialog.Title>Выйти из готовки?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Прогресс и таймеры сохранятся — продолжить можно с главного экрана.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              textColor={theme.colors.error}
              onPress={() => {
                setExitOpen(false);
                store().abandon();
                router.back();
              }}>
              Отменить готовку
            </Button>
            <Button
              onPress={() => {
                setExitOpen(false);
                store().leave();
                router.back();
              }}>
              Выйти
            </Button>
            <Button mode="contained" onPress={() => setExitOpen(false)}>
              Остаться
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={conflict !== null} dismissable={false}>
          <Dialog.Title>Есть незаконченная готовка</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">«{conflict?.recipeName}» не доделано. Продолжить её?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => store().startFresh()}>Начать новую</Button>
            <Button
              mode="contained"
              onPress={() => {
                if (!conflict) return;
                store().leave();
                router.replace({ pathname: '/cook/[id]', params: { id: conflict.recipeId } });
              }}>
              Продолжить
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.lg },
  progress: { height: 6, marginHorizontal: spacing.lg, borderRadius: 3 },
  viewSwitch: { marginHorizontal: spacing.lg, marginTop: spacing.md },
  otherTimers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  body: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  stepText: { lineHeight: 34 },
  ingredients: { gap: 0 },
  checkbox: { paddingHorizontal: 0, minHeight: 48 },
  checkboxLabel: { textAlign: 'left' },
  nav: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  big: { minHeight: 56 },
  reverse: { flexDirection: 'row-reverse' },
  dialogActions: { flexWrap: 'wrap' },
});
