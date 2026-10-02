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
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
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
  const t = useT();
  const content = useContent();
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
    progress.timers.some((timer) => timer.startedAt !== null),
  );
  const runningTimers = activeTimers(progress.timers, now);

  // Alert once per timer when it reaches zero while the screen is open.
  const alerted = useRef(new Set<string>());
  useEffect(() => {
    for (const timer of progress.timers) {
      const key = `${timer.stepOrder}:${timer.startedAt}`;
      if (timer.startedAt !== null && isDone(timer, now) && !alerted.current.has(key)) {
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
    return <EmptyState icon="alert-circle-outline" title={t('cooking.screen.notFound')} />;
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
        ? t('cooking.undo.eaten', {
            kcal: formatInt(result.perPortion.kcal),
            protein: formatInt(result.perPortion.protein),
          })
        : t('cooking.undo.stored', { count: result.stored }),
      () => {
        try {
          repositories.cook.undo(result.sessionId);
        } catch {
          showUndo(t('cooking.undo.cannotUndo'));
        }
      },
    );
    router.dismissTo('/');
  };

  const recipeName = content.recipeName(recipe);
  const timerLabel = t('cooking.screen.timerLabel', { recipe: recipeName, order: step.order });
  const otherTimers = runningTimers.filter((timer) => timer.stepOrder !== step.order);

  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <IconButton
          icon="close"
          onPress={() => setExitOpen(true)}
          accessibilityLabel={t('cooking.screen.exitA11y')}
        />
        <View style={styles.flex}>
          <Text variant="labelLarge" numberOfLines={1}>
            {recipeName}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {finished
              ? t('cooking.screen.allStepsDone')
              : t('cooking.screen.stepOf', { current: stepIndex + 1, total: steps.length })}
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
            { value: 'steps', label: t('cooking.screen.viewSteps'), icon: 'format-list-numbered' },
            { value: 'overview', label: t('cooking.screen.viewOverview'), icon: 'text-long' },
          ]}
        />
      )}

      {otherTimers.length > 0 ? (
        <View style={styles.otherTimers}>
          {otherTimers.map((timer) => (
            <Chip
              key={timer.stepOrder}
              icon={isDone(timer, now) ? 'bell-ring' : 'timer-outline'}
              onPress={() => {
                // Timers live on their steps: jump there in the step-by-step view.
                repositories.settings.setCookView('steps');
                go(steps.findIndex((s) => s.order === timer.stepOrder));
              }}
              accessibilityLabel={t('cooking.screen.otherTimerA11y', { order: timer.stepOrder })}>
              {isDone(timer, now)
                ? t('cooking.screen.otherTimerDone', { order: timer.stepOrder })
                : t('cooking.screen.otherTimerLeft', {
                    order: timer.stepOrder,
                    time: formatTimer(remainingSec(timer, now)),
                  })}
            </Chip>
          ))}
        </View>
      ) : null}

      {finished ? (
        <FinishView
          recipeName={recipeName}
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
                {content.stepText(recipe.id, step.order, step.text, step.textEn)}
              </Text>

              {used.length > 0 ? (
                <View style={styles.ingredients}>
                  {used.map((u) => {
                    const key = `${step.order}:${u.ingredientId}`;
                    const ingredient = ingredients.get(u.ingredientId);
                    const name = ingredient ? content.ingredientName(ingredient) : u.ingredientId;
                    const amount =
                      u.amount === null
                        ? t('cooking.screen.toTaste')
                        : formatAmount(u.amount, u.unit);
                    return (
                      <Checkbox.Item
                        key={key}
                        label={t('cooking.screen.ingredientLine', { name, amount })}
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
                  timer={progress.timers.find((timer) => timer.stepOrder === step.order)}
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
              {t('common.actions.back')}
            </Button>
            <Button
              mode="contained"
              icon={stepIndex === steps.length - 1 ? 'check' : 'arrow-right'}
              contentStyle={[styles.big, styles.reverse]}
              onPress={() => go(stepIndex + 1)}
              style={styles.flex}>
              {stepIndex === steps.length - 1 ? t('cooking.screen.done') : t('cooking.screen.next')}
            </Button>
          </View>
        </>
      )}

      <Portal>
        <Dialog visible={exitOpen} onDismiss={() => setExitOpen(false)}>
          <Dialog.Title>{t('cooking.exit.title')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('cooking.exit.body')}</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              textColor={theme.colors.error}
              onPress={() => {
                setExitOpen(false);
                store().abandon();
                router.back();
              }}>
              {t('cooking.exit.abandon')}
            </Button>
            <Button
              onPress={() => {
                setExitOpen(false);
                store().leave();
                router.back();
              }}>
              {t('cooking.exit.leave')}
            </Button>
            <Button mode="contained" onPress={() => setExitOpen(false)}>
              {t('cooking.exit.stay')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={conflict !== null} dismissable={false}>
          <Dialog.Title>{t('cooking.conflict.title')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {conflict
                ? t('cooking.conflict.body', {
                    name: content.recipeName({ id: conflict.recipeId, name: conflict.recipeName }),
                  })
                : null}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => store().startFresh()}>{t('cooking.conflict.startNew')}</Button>
            <Button
              mode="contained"
              onPress={() => {
                if (!conflict) return;
                store().leave();
                router.replace({ pathname: '/cook/[id]', params: { id: conflict.recipeId } });
              }}>
              {t('common.actions.continue')}
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
