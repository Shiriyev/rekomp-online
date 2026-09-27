import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { remaining, type DaySummary, type Targets } from '@/domain/today';
import { MEAL_LABELS, MEAL_ORDER } from '@/features/meals';
import { formatInt } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { MacroRing } from '@/ui/MacroRing';

type Props = { summary: DaySummary; targets: Targets };

export function TodaySummaryCard({ summary, targets }: Props) {
  const theme = useAppTheme();
  const { total, byMeal } = summary;
  const left = remaining(total, targets);
  const over = left.kcal < 0;
  const kcalColor = over ? theme.colors.error : theme.colors.kcal;
  const track = theme.colors.surfaceVariant;

  return (
    <Card mode="elevated">
      <Card.Content style={styles.content}>
        <View style={styles.rings}>
          <View style={styles.ringColumn}>
            <MacroRing
              progress={total.kcal / targets.kcalTarget}
              color={kcalColor}
              trackColor={track}
              accessibilityLabel={`Калории: ${formatInt(total.kcal)} из ${formatInt(targets.kcalTarget)}`}>
              <Text variant="headlineSmall">{formatInt(total.kcal)}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                из {formatInt(targets.kcalTarget)} ккал
              </Text>
            </MacroRing>
            <Text variant="bodyMedium" style={{ color: over ? theme.colors.error : undefined }}>
              {over
                ? `Перебор ${formatInt(-left.kcal)} ккал`
                : `Осталось ${formatInt(left.kcal)} ккал`}
            </Text>
          </View>

          <View style={styles.ringColumn}>
            <MacroRing
              progress={total.protein / targets.proteinTargetG}
              color={theme.colors.protein}
              trackColor={track}
              accessibilityLabel={`Белок: ${formatInt(total.protein)} из ${formatInt(targets.proteinTargetG)} грамм`}>
              <Text variant="headlineSmall">{formatInt(total.protein)}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                из {formatInt(targets.proteinTargetG)} г белка
              </Text>
            </MacroRing>
            <Text variant="bodyMedium">
              {left.proteinToMin > 0
                ? `До минимума ${formatInt(left.proteinToMin)} г`
                : left.proteinToTarget > 0
                  ? `До цели ${formatInt(left.proteinToTarget)} г`
                  : 'Белок на сегодня есть ✓'}
            </Text>
          </View>
        </View>

        <View style={styles.meals}>
          {MEAL_ORDER.map((meal) => (
            <View key={meal} style={styles.meal} accessible>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {MEAL_LABELS[meal]}
              </Text>
              <Text variant="titleSmall">{formatInt(byMeal[meal].kcal)}</Text>
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  rings: { flexDirection: 'row', justifyContent: 'space-around' },
  ringColumn: { alignItems: 'center', gap: spacing.sm },
  meals: { flexDirection: 'row', justifyContent: 'space-between' },
  meal: { alignItems: 'center', flex: 1 },
});
