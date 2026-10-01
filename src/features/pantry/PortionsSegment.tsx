import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { repositories } from '@/db';
import { useAvailablePortions } from '@/db/hooks';
import { daysBetween } from '@/domain/dates';
import { deviceTimeZone, getLogicalDate } from '@/domain/day';
import { suggestMealType } from '@/domain/today';
import { showUndo } from '@/features/undo/undoStore';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatInt, formatKcal } from '@/lib/format';
import { useClock } from '@/lib/useClock';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { QuantityStepper } from '@/ui/QuantityStepper';

/** Cooked food keeps ~3 days in the fridge; older containers get a warning. */
const FRESH_DAYS = 3;

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
        const age = daysBetween(getLogicalDate(p.cookedAt, dayStartHour, deviceTimeZone()), today);
        const old = age > FRESH_DAYS;
        const name = content.recipeName({ id: p.recipeId, name: p.recipeName });
        const cooked =
          age <= 0
            ? t('pantry.portions.cookedToday')
            : age === 1
              ? t('pantry.portions.cookedYesterday')
              : t('pantry.portions.cookedDaysAgo', { count: age });
        return (
          <Card key={p.id} mode="outlined">
            <Card.Content style={styles.content}>
              <Text variant="titleMedium">{name}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('pantry.portions.perPortion', {
                  kcal: formatKcal(p.kcalPerPortion),
                  protein: formatInt(p.proteinPerPortion),
                })}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: old ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                {cooked}
                {old ? t('pantry.portions.checkFreshness') : ''}
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
                compact
                textColor={theme.colors.error}
                style={styles.discard}
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
