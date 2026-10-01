import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  /** Bundled asset (require) or a file photo; undefined shows the placeholder. */
  source: number | { uri: string } | undefined;
  fallbackIcon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Box styles (size, radius); applied to the photo or the placeholder. */
  style?: StyleProp<ImageStyle>;
  iconSize?: number;
  accessibilityLabel?: string;
};

/** Bundled photo, or a tinted icon placeholder when there is none (or it fails to load). */
export function ImageWithFallback({
  source,
  fallbackIcon,
  style,
  iconSize = 40,
  accessibilityLabel,
}: Props) {
  const theme = useAppTheme();
  const [failed, setFailed] = useState(false);

  if (source === undefined || failed) {
    return (
      <View
        style={[styles.fallback, { backgroundColor: theme.colors.secondaryContainer }, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityLabel ? 'image' : undefined}>
        <MaterialCommunityIcons
          name={fallbackIcon}
          size={iconSize}
          color={theme.colors.onSecondaryContainer}
          importantForAccessibility="no"
        />
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[styles.image, style]}
      contentFit="cover"
      transition={200}
      onError={() => setFailed(true)}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { overflow: 'hidden' },
});
