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
  // Lists (FlashList) reuse row views: the key ties state and pixels to this very source,
  // so a reused row never shows the previous product's photo or its «failed» placeholder.
  const sourceKey =
    source === undefined ? 'none' : typeof source === 'number' ? String(source) : source.uri;
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const failed = failedKey === sourceKey;

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
      recyclingKey={sourceKey}
      // Every image here is a local file (bundled or the user's photo). A disk cache only
      // costs space, and it is keyed by Android resource ids that shift between app builds:
      // after an update it served the old picture under a product's new id.
      cachePolicy="memory"
      onError={() => setFailedKey(sourceKey)}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { overflow: 'hidden' },
});
