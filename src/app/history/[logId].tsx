import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text } from 'react-native-paper';

import { repositories } from '@/db';
import { useIngredientsMap, useMealLogDetail } from '@/db/hooks';
import type { PantryDelta } from '@/db/schema';
import { addDays } from '@/domain/dates';
import { entryPhoto } from '@/domain/entryDetail';
import { DeleteEntryDialog } from '@/features/history/DeleteEntryDialog';
import { planDelete, type DeletePlan } from '@/features/history/deleteEntry';
import { EditEntrySheet, type EditEntrySheetHandle } from '@/features/history/EditEntrySheet';
import { RECIPE_IMAGES } from '@/features/images';
import { MEAL_ICONS, MEAL_LABELS } from '@/features/meals';
import { persistPhoto, releasePhoto } from '@/features/photos/mealPhotos';
import { PhotoField } from '@/features/photos/PhotoField';
import { PhotoViewer } from '@/features/photos/PhotoViewer';
import { showUndo } from '@/features/undo/undoStore';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount, formatDayLabel, formatDecimal, formatInt, formatTime } from '@/lib/format';
import { useClock } from '@/lib/useClock';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { ImageWithFallback } from '@/ui/ImageWithFallback';
import { SkeletonDetail } from '@/ui/Skeleton';

const SOURCE_ICONS = {
  recipe: 'chef-hat',
  portion: 'fridge-outline',
  manual: 'pencil-outline',
} as const;

export default function EntryDetailScreen() {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const { log, recipe, session, isLoaded } = useMealLogDetail(logId);
  const ingredients = useIngredientsMap();
  const { today } = useClock();
  const editRef = useRef<EditEntrySheetHandle>(null);
  const [deletePlan, setDeletePlan] = useState<DeletePlan | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  if (log && !seen) setSeen(true);

  // Leave once the entry is gone (deleted here); Undo from the snackbar still works.
  useEffect(() => {
    if (!log && isLoaded && seen && router.canGoBack()) router.back();
  }, [log, isLoaded, seen]);

  if (isLoaded && !log && !seen) {
    return <EmptyState icon="alert-circle-outline" title={t('history.detail.notFound')} />;
  }
  if (!log) return <SkeletonDetail />;

  const name = content.entryName(log);
  const productName = (id: string) => {
    const ingredient = ingredients.get(id);
    return ingredient ? content.ingredientName(ingredient) : id;
  };

  const photo = entryPhoto(log, recipe?.imageKey, (key) => key in RECIPE_IMAGES);
  const viewerSource =
    photo.kind === 'own'
      ? { uri: photo.uri }
      : photo.kind === 'recipe'
        ? (RECIPE_IMAGES[photo.imageKey] ?? null)
        : null;

  // Products taken with this entry: a manual deduction or the (not undone) cook.
  const deducted: PantryDelta =
    log.source === 'manual'
      ? (log.pantryDelta ?? [])
      : session && session.undoneAt === null
        ? (session.pantryDelta ?? [])
        : [];

  const changePhoto = (picked: string | null) => {
    if (picked === null) {
      const old = repositories.logs.setPhoto(log.id, null);
      showUndo(
        t('history.detail.photoRemoved'),
        () => repositories.logs.setPhoto(log.id, old),
        () => releasePhoto(old),
      );
      return;
    }
    const uri = persistPhoto(picked);
    const old = repositories.logs.setPhoto(log.id, uri);
    if (old) {
      showUndo(
        t('history.detail.photoReplaced'),
        () => {
          repositories.logs.setPhoto(log.id, old);
          releasePhoto(uri);
        },
        () => releasePhoto(old),
      );
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: MEAL_LABELS[log.mealType] }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => viewerSource && setViewerOpen(true)}
          disabled={!viewerSource}
          accessibilityRole="imagebutton"
          accessibilityLabel={viewerSource ? t('history.detail.photoA11y', { name }) : name}>
          {photo.kind === 'own' ? (
            <Image source={{ uri: photo.uri }} style={styles.hero} contentFit="cover" />
          ) : (
            <ImageWithFallback
              source={photo.kind === 'recipe' ? RECIPE_IMAGES[photo.imageKey] : undefined}
              fallbackIcon={MEAL_ICONS[log.mealType]}
              style={styles.hero}
              iconSize={72}
            />
          )}
        </Pressable>

        <View style={styles.section}>
          <Text variant="headlineSmall" accessibilityRole="header">
            {name}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatDayLabel(log.localDate, today, addDays(today, -1))} · {formatTime(log.timestamp)}{' '}
            · {MEAL_LABELS[log.mealType]}
          </Text>
        </View>

        <Card
          mode="contained"
          style={[styles.inset, { backgroundColor: theme.colors.primaryContainer }]}>
          <Card.Content style={styles.macros}>
            <View>
              <Text variant="headlineMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                {t('common.kcalValue', { value: formatInt(log.kcal) })}
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                {t('common.proteinValue', { value: formatDecimal(log.protein) })}
              </Text>
            </View>
            <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer }}>
              {t('history.detail.servings', { value: formatDecimal(log.servings) })}
              {session && session.servings > 1
                ? `\n${t('history.detail.cooked', { count: session.servings })}`
                : ''}
            </Text>
          </Card.Content>
        </Card>

        <View style={styles.section}>
          <View style={styles.row}>
            <Chip icon={SOURCE_ICONS[log.source]}>{t(`history.detail.source.${log.source}`)}</Chip>
            {log.recipeId && recipe ? (
              <Button
                compact
                icon="book-open-variant"
                onPress={() =>
                  router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })
                }>
                {t('history.detail.openRecipe')}
              </Button>
            ) : null}
          </View>
        </View>

        {deducted.length > 0 ? (
          <View style={styles.section}>
            <Text variant="titleMedium" accessibilityRole="header">
              {t('history.detail.deducted')}
            </Text>
            {deducted.map((d, i) => (
              <View key={d.ingredientId}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.line}>
                  <Text variant="bodyLarge" style={styles.flex}>
                    {productName(d.ingredientId)}
                  </Text>
                  <Text variant="bodyLarge">{formatAmount(d.amount, d.unit)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {session?.usedAmounts && session.usedAmounts.length > 0 ? (
          <View style={styles.section}>
            <Text variant="titleMedium" accessibilityRole="header">
              {session.servings > 1
                ? t('history.detail.usedFor', { count: session.servings })
                : t('history.detail.used')}
            </Text>
            {session.usedAmounts.map((u, i) => (
              <View key={u.ingredientId}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.line}>
                  <Text variant="bodyLarge" style={styles.flex}>
                    {productName(u.ingredientId)}
                  </Text>
                  <Text variant="bodyLarge">{formatAmount(u.amount, u.unit)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {log.photoUri ? t('addMeal.photo.own') : t('addMeal.photo.addOwn')}
          </Text>
          <PhotoField value={log.photoUri} onChange={changePhoto} showPreview={false} />
        </View>

        <View style={styles.actions}>
          <Button
            mode="contained-tonal"
            icon="pencil-outline"
            onPress={() => editRef.current?.open(log)}
            contentStyle={styles.button}>
            {t('common.actions.edit')}
          </Button>
          <Button
            mode="outlined"
            icon="delete-outline"
            textColor={theme.colors.error}
            onPress={() => setDeletePlan(planDelete(log))}
            contentStyle={styles.button}>
            {t('history.detail.deleteEntry')}
          </Button>
        </View>
      </ScrollView>

      <EditEntrySheet ref={editRef} />
      <DeleteEntryDialog plan={deletePlan} onDone={() => setDeletePlan(null)} />
      <PhotoViewer
        source={viewerOpen ? viewerSource : null}
        onClose={() => setViewerOpen(false)}
        accessibilityLabel={name}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: { width: '100%', height: 260 },
  section: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  inset: { marginHorizontal: spacing.lg },
  macros: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  line: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: spacing.md },
  actions: { paddingHorizontal: spacing.lg, gap: spacing.md },
  button: { minHeight: 52 },
});
