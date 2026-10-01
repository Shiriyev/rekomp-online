import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { calculateTargets, type BodyInput } from '@/domain/calculator';
import type { ActivityLevel, GoalRate } from '@/domain/types';
import { useT } from '@/i18n';
import { formatInt, formatKcal } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

type Props = { body: BodyInput; activityLevel: ActivityLevel; goalRate: GoalRate };

/** Live result of the calculator while the user fills in the form. */
export function TargetsPreview({ body, activityLevel, goalRate }: Props) {
  const theme = useAppTheme();
  const tr = useT();
  const t = calculateTargets(body, activityLevel, goalRate);

  return (
    <Card mode="contained" style={{ backgroundColor: theme.colors.primaryContainer }}>
      <Card.Content style={styles.content}>
        <Text variant="labelLarge" style={{ color: theme.colors.onPrimaryContainer }}>
          {tr('profile.preview.title')}
        </Text>
        <Text
          variant="displaySmall"
          style={{ color: theme.colors.onPrimaryContainer }}
          accessibilityLabel={tr('profile.preview.kcalA11y', { kcal: t.kcalTarget })}>
          {formatKcal(t.kcalTarget)}
        </Text>
        <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
          {tr('profile.proteinRange', {
            min: formatInt(t.proteinMinG),
            target: formatInt(t.proteinTargetG),
          })}
        </Text>
        <View style={styles.row}>
          <Stat label={tr('profile.preview.bmr')} value={formatInt(t.bmr)} />
          <Stat label={tr('profile.preview.tdee')} value={formatInt(t.tdee)} />
          <Stat
            label={tr('profile.preview.deficit')}
            value={t.deficit === 0 ? '0' : `−${formatInt(t.deficit)}`}
          />
        </View>
        {t.clampedToFloor ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.warning }}>
            {tr('profile.preview.clamped')}
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
