import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { calculateTargets, type BodyInput } from '@/domain/calculator';
import type { ActivityLevel, GoalRate } from '@/domain/types';
import { formatInt, formatKcal } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

type Props = { body: BodyInput; activityLevel: ActivityLevel; goalRate: GoalRate };

/** Live result of the calculator while the user fills in the form. */
export function TargetsPreview({ body, activityLevel, goalRate }: Props) {
  const theme = useAppTheme();
  const t = calculateTargets(body, activityLevel, goalRate);

  return (
    <Card mode="contained" style={{ backgroundColor: theme.colors.primaryContainer }}>
      <Card.Content style={styles.content}>
        <Text variant="labelLarge" style={{ color: theme.colors.onPrimaryContainer }}>
          Расчёт на день
        </Text>
        <Text
          variant="displaySmall"
          style={{ color: theme.colors.onPrimaryContainer }}
          accessibilityLabel={`Цель ${t.kcalTarget} килокалорий`}>
          {formatKcal(t.kcalTarget)}
        </Text>
        <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
          Белок {formatInt(t.proteinMinG)}–{formatInt(t.proteinTargetG)} г
        </Text>
        <View style={styles.row}>
          <Stat label="Обмен (BMR)" value={formatInt(t.bmr)} />
          <Stat label="Расход (TDEE)" value={formatInt(t.tdee)} />
          <Stat label="Дефицит" value={t.deficit === 0 ? '0' : `−${formatInt(t.deficit)}`} />
        </View>
        {t.clampedToFloor ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.warning }}>
            Расчёт получился слишком низким — цель поднята до безопасного минимума. Выберите темп
            помедленнее.
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.stat}>
      <Text variant="labelSmall" style={{ color: theme.colors.onPrimaryContainer }}>
        {label}
      </Text>
      <Text variant="titleSmall" style={{ color: theme.colors.onPrimaryContainer }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xs },
  row: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.md },
  stat: { flex: 1 },
});
