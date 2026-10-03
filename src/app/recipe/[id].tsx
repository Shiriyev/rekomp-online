import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  IconButton,
  Dialog,
  Divider,
  Portal,
  SegmentedButtons,
  Snackbar,
  Text,
} from 'react-native-paper';

import { repositories } from '@/db';
import {
  useFavoriteRecipeIds,
  useIngredientsMap,
  usePantryStock,
  useRecipeDetail,
} from '@/db/hooks';
import { recipeMacros, resolveLines } from '@/domain/nutrition';
import { autoChoices, canCook } from '@/domain/pantry';
import { isStockTracked, MEAL_TYPES, type MealType } from '@/domain/types';
import { applyAmounts, draftStep, isRemoved } from '@/domain/recipeDraft';
import {
  persistPhoto,
  pickPhoto,
  releasePhoto,
  type PhotoSource,
} from '@/features/photos/mealPhotos';
import { MEAL_ICONS, MEAL_LABELS } from '@/features/meals';
import { IngredientRow } from '@/features/recipes/IngredientRow';
import {
  clearRecipeDraft,
  useRecipeDraft,
  useRecipeDraftStore,
} from '@/features/recipes/recipeDraftStore';
import { recipeImage } from '@/features/recipes/recipeImage';
import { StatusBadge } from '@/features/recipes/StatusBadge';
import { useKcalLeftToday } from '@/features/recipes/useKcalLeftToday';
import { showUndo } from '@/features/undo/undoStore';
import { t as translate, useT } from '@/i18n';
import { content as contentNow, useContent } from '@/i18n/content';
import { formatAmount, formatInt, formatKcal } from '@/lib/format';
import { useTransitionDone } from '@/lib/useTransitionDone';
import { radius, spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';
import { SkeletonDetail } from '@/ui/Skeleton';

const SERVING_OPTIONS = [1, 2, 3, 4] as const;
const isMealType = (v: unknown): v is MealType =>
  typeof v === 'string' && (MEAL_TYPES as readonly string[]).includes(v);
const NIGHT_BEFORE_TAG = 'с вечера';

export default function RecipeScreen() {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const { id, meal } = useLocalSearchParams<{ id: string; meal?: string }>();
  const { recipe, lines, hasCustom, isLoaded } = useRecipeDetail(id);
  const draft = useRecipeDraft(id);
  const setDraftAmount = useRecipeDraftStore((s) => s.setAmount);
  const ingredients = useIngredientsMap();
  const pantry = usePantryStock();
  const kcalLeft = useKcalLeftToday();

  const [servingsOverride, setServings] = useState<number | null>(null);
  const [userChoices, setUserChoices] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ready = useTransitionDone();
  const isFavorite = useFavoriteRecipeIds().has(id);

  const servings = servingsOverride ?? recipe?.defaultServings ?? 1;

  const computed = useMemo(() => {
    if (!recipe || ingredients.size === 0 || lines.length === 0) return null;
    // The card edits a draft of this cook: status, macros and shopping use the drafted amounts.
    const drafted = applyAmounts(lines, draft);
    const choices = { ...autoChoices(drafted, ingredients, pantry, servings), ...userChoices };
    const check = canCook(drafted, ingredients, pantry, servings, choices);
    const macros = recipeMacros(drafted, ingredients, { servings, choices });
    const baseMacros = recipeMacros(lines, ingredients, { servings, choices });
    const resolved = resolveLines(drafted, choices);
    const used = resolved.filter((l) => {
      const i = ingredients.get(l.ingredientId);
      return i ? isStockTracked(i) : false;
    });
    // Broth and the like: in the recipe and its nutrition, but not kept track of at home.
    const basics = resolved.flatMap((l) => {
      const i = ingredients.get(l.ingredientId);
      return i && !i.isStaple && !isStockTracked(i) && l.amountPerServing > 0
        ? [
            `${contentNow.ingredientName(i).toLocaleLowerCase()} ${formatAmount(l.amountPerServing * servings, l.unit)}`,
          ]
        : [];
    });
    const staples = lines.flatMap((l) => {
      const i = ingredients.get(l.ingredientId);
      return i?.isStaple ? [contentNow.ingredientName(i).toLocaleLowerCase()] : [];
    });
    return { check, macros, baseMacros, used, staples, basics };
  }, [recipe, lines, draft, ingredients, pantry, servings, userChoices]);

  if (isLoaded && !recipe) {
    return <EmptyState icon="alert-circle-outline" title={t('recipes.card.notFound')} />;
  }
  if (!ready || !recipe || !computed) return <SkeletonDetail still={!ready} />;

  const { check, macros, baseMacros, used, staples, basics } = computed;
  const perServing = macros.perServing;
  const after = kcalLeft - perServing.kcal;
  const drafted = Object.keys(draft).length > 0;
  const recipeName = content.recipeName(recipe);
  // Compare what is shown, so «46 → 46» never appears.
  const kcalChanged = formatInt(perServing.kcal) !== formatInt(baseMacros.perServing.kcal);
  const proteinChanged = formatInt(perServing.protein) !== formatInt(baseMacros.perServing.protein);
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
    showUndo(translate('recipes.card.logged', { name: recipeName }), () =>
      repositories.cook.undo(result.sessionId),
    );
    router.back();
  };

  const saveAsMine = () => {
    repositories.recipes.saveCustomAmounts(recipe.id, applyAmountsMap(lines, draft));
    clearRecipeDraft(recipe.id);
    setMessage(t('recipes.card.savedMine'));
  };

  const changeDishPhoto = async (source: PhotoSource | 'original') => {
    let uri: string | null = null;
    if (source !== 'original') {
      const outcome = await pickPhoto(source);
      if (outcome.kind === 'denied') setMessage(t('recipes.card.photoDenied'));
      if (outcome.kind !== 'picked') return;
      uri = persistPhoto(outcome.uri);
    }
    const old = repositories.recipes.setPhoto(recipe.id, uri);
    showUndo(
      t(uri ? 'recipes.card.photoUpdated' : 'recipes.card.photoRestored'),
      () => {
        repositories.recipes.setPhoto(recipe.id, old);
        releasePhoto(uri);
      },
      () => releasePhoto(old),
    );
  };

  const addMissing = () => {
    const n = repositories.shopping.addMissing(check.missing);
    setMessage(
      n > 0 ? t('recipes.card.addedToList', { count: n }) : t('recipes.card.alreadyInList'),
    );
  };

  const onColor = theme.colors.onPrimaryContainer;

  return (
    <>
      {/* Titled with the list it was opened from; a recipe can fit several meals. */}
      <Stack.Screen options={{ title: MEAL_LABELS[isMealType(meal) ? meal : recipe.mealType] }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <ImageWithFallback
            source={recipeImage(recipe)}
            fallbackIcon={MEAL_ICONS[recipe.mealType]}
            style={styles.hero}
            iconSize={72}
            accessibilityLabel={recipeName}
          />
          <View style={styles.heroActions}>
            <IconButton
              icon={isFavorite ? 'heart' : 'heart-outline'}
              mode="contained"
              containerColor="rgba(0,0,0,0.55)"
              iconColor={isFavorite ? theme.colors.error : '#FFFFFF'}
              onPress={() => {
                const saved = repositories.recipes.toggleFavorite(recipe.id);
                setMessage(saved ? t('recipes.browse.saved') : t('recipes.browse.unsaved'));
              }}
              accessibilityLabel={
                isFavorite ? t('recipes.browse.unsave') : t('recipes.browse.save')
              }
              accessibilityState={{ selected: isFavorite }}
            />
            <IconButton
              icon="camera-outline"
              mode="contained"
              containerColor="rgba(0,0,0,0.55)"
              iconColor="#FFFFFF"
              onPress={() => void changeDishPhoto('camera')}
              accessibilityLabel={t('recipes.card.photoCamera')}
            />
            <IconButton
              icon="image-outline"
              mode="contained"
              containerColor="rgba(0,0,0,0.55)"
              iconColor="#FFFFFF"
              onPress={() => void changeDishPhoto('library')}
              accessibilityLabel={t('recipes.card.photoGallery')}
            />
            {recipe.photoUri ? (
              <IconButton
                icon="restore"
                mode="contained"
                containerColor="rgba(0,0,0,0.55)"
                iconColor="#FFFFFF"
                onPress={() => void changeDishPhoto('original')}
                accessibilityLabel={t('recipes.card.photoOriginal')}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="headlineSmall" accessibilityRole="header">
            {recipeName}
          </Text>
          {content.recipeDescription(recipe) ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {content.recipeDescription(recipe)}
            </Text>
          ) : null}
          <View style={styles.chips}>
            <Chip compact mode="outlined" icon="clock-outline">
              {t('recipes.card.minutes', { minutes: recipe.totalMinutes })}
            </Chip>
            {recipe.prepNightBefore ? (
              <Chip compact mode="outlined" icon="weather-night">
                {t('recipes.card.nightBefore')}
              </Chip>
            ) : null}
            {recipe.tags
              .filter((tag) => tag !== NIGHT_BEFORE_TAG)
              .map((tag) => (
                <Chip compact mode="outlined" key={tag}>
                  {content.tag(tag)}
                </Chip>
              ))}
          </View>
        </View>

        <View style={[styles.macros, { backgroundColor: theme.colors.primaryContainer }]}>
          <View style={styles.flex}>
            <View style={styles.kcalRow}>
              <Text
                variant="headlineMedium"
                style={{ color: onColor }}
                accessibilityLabel={
                  kcalChanged
                    ? t('recipes.card.kcalA11y', {
                        kcal: formatInt(perServing.kcal),
                        base: formatInt(baseMacros.perServing.kcal),
                      })
                    : formatKcal(perServing.kcal)
                }>
                {formatKcal(perServing.kcal)}
              </Text>
              {kcalChanged ? (
                <Text variant="titleSmall" style={[styles.was, { color: onColor }]}>
                  {formatInt(baseMacros.perServing.kcal)}
                </Text>
              ) : null}
            </View>
            <View style={styles.kcalRow}>
              <Text variant="titleMedium" style={{ color: onColor }}>
                {t('common.proteinValue', { value: formatInt(perServing.protein) })}
              </Text>
              {proteinChanged ? (
                <Text variant="bodyMedium" style={[styles.was, { color: onColor }]}>
                  {formatInt(baseMacros.perServing.protein)} {t('common.grams')}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.macrosRight}>
            <Text variant="bodySmall" style={{ color: onColor }}>
              {t('recipes.card.perServing')}
            </Text>
            <Text variant="bodyMedium" style={{ color: after < 0 ? theme.colors.error : onColor }}>
              {after < 0
                ? t('recipes.card.overKcal', { kcal: formatInt(-after) })
                : t('recipes.card.leftKcal', { kcal: formatInt(after) })}
            </Text>
          </View>
        </View>

        {recipe.isBatch ? (
          <View style={styles.section}>
            <Text variant="titleMedium">{t('recipes.card.servings')}</Text>
            <SegmentedButtons
              value={String(servings)}
              onValueChange={(v) => setServings(Number(v))}
              buttons={SERVING_OPTIONS.map((n) => ({
                value: String(n),
                label: String(n),
                showSelectedCheck: false,
              }))}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('recipes.card.batchTotal', {
                kcal: formatKcal(macros.total.kcal),
                protein: formatInt(macros.total.protein),
              })}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.titleRow}>
            <Text variant="titleMedium" accessibilityRole="header">
              {recipe.isBatch
                ? t('recipes.card.productsFor', { count: servings })
                : t('recipes.card.products')}
            </Text>
            <StatusBadge check={check} />
          </View>

          {drafted || hasCustom ? (
            <View style={[styles.banner, { backgroundColor: theme.colors.secondaryContainer }]}>
              <MaterialCommunityIcons
                name={drafted ? 'tune-variant' : 'account-heart-outline'}
                size={22}
                color={theme.colors.onSecondaryContainer}
              />
              <View style={styles.flex}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSecondaryContainer }}>
                  {drafted ? t('recipes.card.editedTitle') : t('recipes.card.myVersion')}
                </Text>
                {drafted ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>
                    {t('recipes.card.editedHint')}
                  </Text>
                ) : null}
                <View style={styles.bannerActions}>
                  {drafted ? (
                    <Button compact icon="restore" onPress={() => clearRecipeDraft(recipe.id)}>
                      {t('recipes.card.resetDraft')}
                    </Button>
                  ) : null}
                  {drafted ? (
                    <Button compact icon="content-save-outline" onPress={saveAsMine}>
                      {t('recipes.card.saveMine')}
                    </Button>
                  ) : (
                    <Button
                      compact
                      icon="history"
                      onPress={() => {
                        repositories.recipes.resetCustomAmounts(recipe.id);
                        setMessage(t('recipes.card.restoredOriginal'));
                      }}>
                      {t('recipes.card.restoreOriginal')}
                    </Button>
                  )}
                </View>
              </View>
            </View>
          ) : null}

          {used.map((line, index) => {
            const ingredient = ingredients.get(line.ingredientId);
            if (!ingredient) return null;
            const base = baseAmountOf(line.ingredientId);
            const name = content.ingredientName(ingredient);
            const setAmount = (n: number) =>
              setDraftAmount(recipe.id, line.ingredientId, n, base, line.unit);
            if (isRemoved(line)) {
              return (
                <View key={line.ingredientId}>
                  {index > 0 ? <Divider /> : null}
                  <View style={styles.removedRow}>
                    <View
                      style={[styles.removedIcon, { borderColor: theme.colors.outlineVariant }]}>
                      <MaterialCommunityIcons
                        name="minus"
                        size={20}
                        color={theme.colors.onSurfaceDisabled}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Text
                        variant="bodyLarge"
                        style={[styles.strike, { color: theme.colors.onSurfaceDisabled }]}>
                        {name}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceDisabled }}>
                        {t('recipes.card.removed')} ·{' '}
                        {t('recipes.card.inRecipe', { amount: formatAmount(base, line.unit) })}
                      </Text>
                    </View>
                    <Button
                      compact
                      mode="outlined"
                      icon="undo"
                      onPress={() => setAmount(base)}
                      accessibilityLabel={t('recipes.card.restoreA11y', { name })}>
                      {t('recipes.card.restoreIngredient')}
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
                  servings={servings}
                  onChooseAlternative={(altId) => {
                    const group = c.line.altGroup;
                    if (group) setUserChoices((prev) => ({ ...prev, [group]: altId }));
                  }}
                  editor={{
                    value: line.amountPerServing,
                    base,
                    step: draftStep(line.unit),
                    onChange: setAmount,
                  }}
                />
              </View>
            );
          })}

          {basics.length > 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('recipes.card.basics', { list: basics.join(', ') })}
            </Text>
          ) : null}
          {staples.length > 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('recipes.card.staples', { list: staples.join(', ') })}
            </Text>
          ) : null}
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('recipes.card.approx')}
          </Text>
        </View>

        <View style={styles.actions}>
          {check.missing.length > 0 ? (
            <Button
              mode="outlined"
              icon="cart-plus"
              onPress={addMissing}
              contentStyle={styles.button}>
              {t('recipes.card.addMissing')}
            </Button>
          ) : null}
          <Button
            mode="contained"
            icon="chef-hat"
            onPress={() => (check.status === 'ok' ? startCooking() : setConfirmOpen(true))}
            contentStyle={styles.button}>
            {t('recipes.card.startCooking')}
          </Button>
          <Button
            mode="text"
            icon="silverware-fork-knife"
            onPress={justAte}
            contentStyle={styles.button}>
            {t('recipes.card.justAte')}
          </Button>
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={confirmOpen} onDismiss={() => setConfirmOpen(false)}>
          <Dialog.Title>{t('recipes.card.notAllTitle')}</Dialog.Title>
          <Dialog.Content style={styles.dialog}>
            {check.missing.map((m) => {
              const i = ingredients.get(m.ingredientId);
              return (
                <Text key={m.ingredientId} variant="bodyMedium">
                  •{' '}
                  {t('recipes.card.notEnough', {
                    name: i ? content.ingredientName(i) : m.ingredientId,
                    amount: formatAmount(m.amount, m.unit),
                  })}
                </Text>
              );
            })}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmOpen(false)}>{t('common.actions.cancel')}</Button>
            <Button mode="contained" onPress={startCooking}>
              {t('recipes.card.startAnyway')}
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

/** The full per-serving amounts the card currently shows. */
const applyAmountsMap = (
  lines: readonly { ingredientId: string; amountPerServing: number }[],
  draft: Readonly<Record<string, number>>,
): Record<string, number> =>
  Object.fromEntries(
    lines.map((l) => [l.ingredientId, draft[l.ingredientId] ?? l.amountPerServing]),
  );

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: { width: '100%', height: 240 },
  heroActions: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
  },
  section: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  macros: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  was: { textDecorationLine: 'line-through', opacity: 0.7 },
  macrosRight: { alignItems: 'flex-end', gap: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'flex-start',
  },
  bannerActions: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -spacing.sm },
  removedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  removedIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  strike: { textDecorationLine: 'line-through' },
  actions: { paddingHorizontal: spacing.lg, gap: spacing.md },
  button: { minHeight: 52 },
  dialog: { gap: spacing.xs },
});
