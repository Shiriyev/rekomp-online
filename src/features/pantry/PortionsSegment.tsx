import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { repositories } from '@/db';
import { useAvailablePortions } from '@/db/hooks';
import { daysBetween, toLocalDate } from '@/domain/dates';
import { suggestMealType } from '@/domain/today';
import { showUndo } from '@/features/undo/undoStore';
import { formatInt, formatKcal, pluralRu } from '@/lib/format';
import { useClock } from '@/lib/useClock';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';
import { QuantityStepper } from '@/ui/QuantityStepper';

/** Cooked food keeps ~3 days in the fridge; older containers get a warning. */
const FRESH_DAYS = 3;

const ageLabel = (days: number) =>
  days <= 0
    ? 'сегодня'
    : days === 1
      ? 'вчера'
      : `${days} ${pluralRu(days, ['день', 'дня', 'дней'])} назад`;

export function PortionsSegment() {
  const theme = useAppTheme();
  const { now, today } = useClock();
  const portions = useAvailablePortions();

  if (portions.length === 0) {
    return (
      <EmptyState
        icon="pot-steam-outline"
        title="Готовых порций нет"
        description="Приготовь обед на несколько дней — порции появятся здесь."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.list}>
      {portions.map((p) => {
        const age = daysBetween(toLocalDate(p.cookedAt), today);
        const old = age > FRESH_DAYS;
        return (
          <Card key={p.id} mode="outlined">
            <Card.Content style={styles.content}>
              <Text variant="titleMedium">{p.recipeName}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatKcal(p.kcalPerPortion)} · {formatInt(p.proteinPerPortion)} г белка на порцию
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: old ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                Приготовлено {ageLabel(age)}
                {old ? ' — проверь свежесть' : ''}
              </Text>
              <View style={styles.row}>
                <QuantityStepper
                  label={`порции ${p.recipeName}`}
                  valueText={`${p.portionsLeft} порц.`}
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
                    showUndo(`Съедена порция: ${p.recipeName}`, () =>
                      repositories.logs.undo(log.id),
                    );
                  }}>
                  Съесть
                </Button>
              </View>
              <Button
                compact
                textColor={theme.colors.error}
                style={styles.discard}
                onPress={() => {
                  const left = p.portionsLeft;
                  repositories.portions.setPortionsLeft(p.id, 0);
                  showUndo(`Выброшено: ${p.recipeName}`, () =>
                    repositories.portions.setPortionsLeft(p.id, left),
                  );
                }}>
                Выбросить всё
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
