import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { remaining, type DaySummary, type Targets } from '@/domain/today';
import { MEAL_LABELS, MEAL_ORDER } from '@/features/meals';
import { useT } from '@/i18n';
import { formatInt } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { MacroRing } from '@/ui/MacroRing';

type Props = { summary: DaySummary; targets: Targets };

export function TodaySummaryCard({ summary, targets }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const { total, byMeal } = summary;
  const left = remaining(total, targets);
  const over = left.kcal < 0;
  const kcalColor = over ? theme.colors.error : theme.colors.kcal;
  const track = theme.colors.surfaceVariant;

  return (
    <Card mode="contained">
      <Card.Content style={styles.content}>
        <View style={styles.rings}>
          <View style={styles.ringColumn}>
            <MacroRing
              progress={total.kcal / targets.kcalTarget}
              color={kcalColor}
              trackColor={track}
              accessibilityLabel={t('today.summary.kcalA11y', {
                eaten: formatInt(total.kcal),
                target: formatInt(targets.kcalTarget),
              })}>
              <Text
                variant="headlineSmall"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.ringText}>
                {formatInt(total.kcal)}
              </Text>
              <Text
                variant="bodySmall"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.ringText, { color: theme.colors.onSurfaceVariant }]}>
                {t('today.summary.kcalOf', { target: formatInt(targets.kcalTarget) })}
              </Text>
            </MacroRing>
            <Text
              variant="bodyMedium"
              style={{ color: over ? theme.colors.error : theme.colors.onSurface }}>
              {over
                ? t('today.summary.kcalOver', { kcal: formatInt(-left.kcal) })
                : t('today.summary.kcalLeft', { kcal: formatInt(left.kcal) })}
            </Text>
          </View>

          <View style={styles.ringColumn}>
            <MacroRing
              progress={total.protein / targets.proteinTargetG}
              color={theme.colors.protein}
              trackColor={track}
              accessibilityLabel={t('today.summary.proteinA11y', {
                eaten: formatInt(total.protein),
                target: formatInt(targets.proteinTargetG),
              })}>
              <Text
                variant="headlineSmall"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.ringText}>
                {formatInt(total.protein)}
              </Text>
              <Text
                variant="bodySmall"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.ringText, { color: theme.colors.onSurfaceVariant }]}>
                {t('today.summary.proteinOf', { target: formatInt(targets.proteinTargetG) })}
              </Text>
            </MacroRing>
            <Text variant="bodyMedium">
              {left.proteinToMin > 0
                ? t('today.summary.toMin', { grams: formatInt(left.proteinToMin) })
                : left.proteinToTarget > 0
                  ? t('today.summary.toTarget', { grams: formatInt(left.proteinToTarget) })
                  : t('today.summary.proteinDone')}
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
  // Keeps ring labels inside the circle at large system font sizes.
  ringText: { maxWidth: 104, textAlign: 'center' },
});
