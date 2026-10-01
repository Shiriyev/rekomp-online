import { StyleSheet, useWindowDimensions, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Button, Chip, Text } from 'react-native-paper';
import { useReducedMotion } from 'react-native-reanimated';

import type { Macros } from '@/domain/types';
import { useT } from '@/i18n';
import { formatInt } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

type Props = {
  recipeName: string;
  perPortion: Macros;
  servings: number;
  isBatch: boolean;
  firstTime: boolean;
  onEatNow: () => void;
  onStoreAll: () => void;
  onBack: () => void;
};

export function FinishView({
  recipeName,
  perPortion,
  servings,
  isBatch,
  firstTime,
  onEatNow,
  onStoreAll,
  onBack,
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

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
        {isBatch
          ? t('cooking.finish.perPortionBatch', { count: servings })
          : t('cooking.finish.perPortion')}
      </Text>
      {firstTime ? (
        <Chip icon="medal-outline" style={styles.badge}>
          {t('cooking.finish.firstTime')}
        </Chip>
      ) : null}

      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="silverware-fork-knife"
          onPress={onEatNow}
          contentStyle={styles.big}>
          {isBatch && servings > 1 ? t('cooking.finish.eatOnePortion') : t('cooking.finish.eatNow')}
        </Button>
        <Button
          mode="outlined"
          icon="fridge-outline"
          onPress={onStoreAll}
          contentStyle={styles.big}>
          {isBatch && servings > 1
            ? t('cooking.finish.storeAll', { count: servings })
            : t('cooking.finish.store')}
        </Button>
        <Button onPress={onBack}>{t('cooking.finish.backToSteps')}</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  center: { textAlign: 'center' },
  badge: { alignSelf: 'center' },
  actions: { gap: spacing.md, marginTop: spacing.xl },
  big: { minHeight: 56 },
});
