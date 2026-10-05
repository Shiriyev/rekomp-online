import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { repositories } from '@/db';
import { useAvailablePortions } from '@/db/hooks';
import { daysBetween } from '@/domain/dates';
import { deviceTimeZone, getLogicalDate } from '@/domain/day';
import { portionFreshness } from '@/domain/servings';
import { suggestMealType } from '@/domain/today';
import { showUndo } from '@/features/undo/undoStore';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatDayLabel, formatInt, formatKcal } from '@/lib/format';
import { useClock } from '@/lib/useClock';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { QuantityStepper } from '@/ui/QuantityStepper';

export function PortionsSegment() {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const { now, today, dayStartHour } = useClock();
  const portions = useAvailablePortions();

  if (portions.length === 0) {
    return (
      <EmptyState
        icon="pot-steam-outline"
        title={t('pantry.portions.emptyTitle')}
        description={t('pantry.portions.emptyDescription')}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.list}>
      {portions.map((p) => {
        const cookedOn = getLogicalDate(p.cookedAt, dayStartHour, deviceTimeZone());
        const age = daysBetween(cookedOn, today);
        const fresh = portionFreshness(cookedOn, p.storageDays, today);
        // Weekday and date; «Сегодня/Вчера» do not fit a date in the future.
        const date = formatDayLabel(fresh.bestBefore, '', '');
        const keeps = fresh.expired
          ? t('pantry.portions.expired', { date })
          : fresh.daysLeft === 0
            ? t('pantry.portions.goodToday')
            : fresh.daysLeft === 1
              ? t('pantry.portions.goodTomorrow')
              : t('pantry.portions.goodUntil', { date });
        const name = content.recipeName({ id: p.recipeId, name: p.recipeName });
        const cooked =
          age <= 0
            ? t('pantry.portions.cookedToday')
            : age === 1
              ? t('pantry.portions.cookedYesterday')
              : t('pantry.portions.cookedDaysAgo', { count: age });
        return (
          <Card
            key={p.id}
            mode="outlined"
            style={fresh.expired ? { borderColor: theme.colors.error } : undefined}>
            <Card.Content style={styles.content}>
              <Text variant="titleMedium">{name}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('pantry.portions.perPortion', {
                  kcal: formatKcal(p.kcalPerPortion),
                  protein: formatInt(p.proteinPerPortion),
                })}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {cooked}
              </Text>
              <Text
                variant={fresh.expired ? 'bodyMedium' : 'bodySmall'}
                style={{
                  color: fresh.expired ? theme.colors.error : theme.colors.onSurfaceVariant,
                }}>
                {keeps}
              </Text>
              <View style={styles.row}>
                <QuantityStepper
                  label={t('pantry.portions.stepperLabel', { name })}
                  valueText={t('pantry.portions.portionsLeft', { n: p.portionsLeft })}
                  onDecrement={() =>
                    repositories.portions.setPortionsLeft(p.id, p.portionsLeft - 1)
                  }
                  onIncrement={() =>
                    repositories.portions.setPortionsLeft(p.id, p.portionsLeft + 1)
                  }
                />
                <Button
                  mode="contained"
                  icon="silverware-fork-knife"
                  onPress={() => {
                    const log = repositories.portions.eat(p.id, suggestMealType(now));
                    showUndo(t('pantry.portions.eaten', { name }), () =>
                      repositories.logs.undo(log.id),
                    );
                  }}>
                  {t('pantry.portions.eat')}
                </Button>
              </View>
              <Button
                compact={!fresh.expired}
                mode={fresh.expired ? 'contained' : 'text'}
                buttonColor={fresh.expired ? theme.colors.error : undefined}
                textColor={fresh.expired ? theme.colors.onError : theme.colors.error}
                icon={fresh.expired ? 'delete-outline' : undefined}
                style={fresh.expired ? undefined : styles.discard}
                onPress={() => {
                  const left = p.portionsLeft;
                  repositories.portions.setPortionsLeft(p.id, 0);
                  showUndo(t('pantry.portions.discarded', { name }), () =>
                    repositories.portions.setPortionsLeft(p.id, left),
                  );
                }}>
                {t('pantry.portions.discardAll')}
              </Button>
            </Card.Content>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  content: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  discard: { alignSelf: 'flex-start', marginLeft: -spacing.sm },
});
