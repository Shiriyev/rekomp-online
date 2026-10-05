import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Button, Chip, Text } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';

import type { Macros } from '@/domain/types';
import { useT } from '@/i18n';
import { formatInt } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { QuantityStepper } from '@/ui/QuantityStepper';

type Props = {
  recipeName: string;
  perPortion: Macros;
  servings: number;
  firstTime: boolean;
  /** Portions eaten now (0…servings); the rest go to «Готовые порции». */
  onFinish: (eaten: number) => void;
  onBack: () => void;
};

export function FinishView({
  recipeName,
  perPortion,
  servings,
  firstTime,
  onFinish,
  onBack,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [eaten, setEaten] = useState(1);
  const stored = servings - eaten;

  return (
    <View style={styles.container}>
      {reduceMotion ? null : (
        <ConfettiCannon
          count={120}
          origin={{ x: width / 2, y: -20 }}
          fadeOut
          autoStart
          explosionSpeed={400}
        />
      )}
      <Text variant="displaySmall" accessibilityRole="header" style={styles.center}>
        {t('cooking.finish.title')}
      </Text>
      <Text variant="titleLarge" style={styles.center}>
        {recipeName}
      </Text>
      <Text variant="headlineSmall" style={[styles.center, { color: theme.colors.primary }]}>
        {t('cooking.finish.macros', {
          kcal: formatInt(perPortion.kcal),
          protein: formatInt(perPortion.protein),
        })}
      </Text>
      <Text variant="bodyMedium" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
        {servings > 1
          ? t('cooking.finish.perPortionBatch', { count: servings })
          : t('cooking.finish.perPortion')}
      </Text>
      {firstTime ? (
        <Chip icon="medal-outline" style={styles.badge}>
          {t('cooking.finish.firstTime')}
        </Chip>
      ) : null}

      {servings > 1 ? (
        <View style={styles.actions}>
          <View style={styles.split}>
            <Text variant="titleMedium">{t('cooking.finish.eatNowLabel')}</Text>
            <QuantityStepper
              label={t('cooking.finish.eatNowLabel')}
              valueText={t('cooking.finish.portions', { count: eaten })}
              onDecrement={() => setEaten((n) => Math.max(0, n - 1))}
              onIncrement={() => setEaten((n) => Math.min(servings, n + 1))}
              decrementDisabled={eaten <= 0}
              incrementDisabled={eaten >= servings}
            />
          </View>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {stored > 0
              ? t('cooking.finish.restStored', { count: stored })
              : t('cooking.finish.nothingStored')}
          </Text>
          <Button
            mode="contained"
            icon={eaten > 0 ? 'silverware-fork-knife' : 'fridge-outline'}
            onPress={() => onFinish(eaten)}
            contentStyle={styles.big}>
            {t('cooking.finish.confirm')}
          </Button>
          <Button onPress={onBack}>{t('cooking.finish.backToSteps')}</Button>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="silverware-fork-knife"
            onPress={() => onFinish(1)}
            contentStyle={styles.big}>
            {t('cooking.finish.eatNow')}
          </Button>
          <Button
            mode="outlined"
            icon="fridge-outline"
            onPress={() => onFinish(0)}
            contentStyle={styles.big}>
            {t('cooking.finish.store')}
          </Button>
          <Button onPress={onBack}>{t('cooking.finish.backToSteps')}</Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  center: { textAlign: 'center' },
  badge: { alignSelf: 'center' },
  actions: { gap: spacing.md, marginTop: spacing.xl },
  split: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  big: { minHeight: 56 },
});
