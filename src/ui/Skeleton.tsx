import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius, spacing, useAppTheme } from '@/theme';

type BlockProps = { width?: DimensionValue; height: number; rounded?: number };

/** Pulsing placeholder block; static when the system asks to reduce motion. */
export function SkeletonBlock({ width = '100%', height, rounded = radius.sm }: BlockProps) {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!reduceMotion) opacity.set(withRepeat(withTiming(0.45, { duration: 700 }), -1, true));
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: rounded, backgroundColor: theme.colors.surfaceVariant },
        style,
      ]}
    />
  );
}

/** Generic list skeleton: thumbnail + two text lines per row. */
export function SkeletonList({ rows = 4, thumb = 88 }: { rows?: number; thumb?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="Загрузка" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonBlock width={thumb} height={thumb} rounded={radius.md} />
          <View style={styles.lines}>
            <SkeletonBlock height={18} width="80%" />
            <SkeletonBlock height={14} width="55%" />
            <SkeletonBlock height={14} width="35%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Skeleton of a screen with a hero image and a few sections. */
export function SkeletonDetail() {
  return (
    <View style={styles.detail} accessibilityLabel="Загрузка" accessibilityRole="progressbar">
      <SkeletonBlock height={220} rounded={0} />
      <View style={styles.detailBody}>
        <SkeletonBlock height={28} width="70%" />
        <SkeletonBlock height={96} rounded={radius.md} />
        <SkeletonBlock height={56} />
        <SkeletonBlock height={56} />
        <SkeletonBlock height={56} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  lines: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  detail: { gap: spacing.lg },
  detailBody: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
