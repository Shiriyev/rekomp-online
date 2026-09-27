import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { spacing, useAppTheme } from '@/theme';

type Props = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, description, actionLabel, onAction }: Props) {
  const theme = useAppTheme();

  return (
    <View style={styles.container} accessibilityRole="summary">
      <MaterialCommunityIcons
        name={icon}
        size={56}
        color={theme.colors.primary}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text variant="titleMedium" style={styles.center}>
        {title}
      </Text>
      {description ? (
        <Text
          variant="bodyMedium"
          style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button mode="contained" onPress={onAction} style={styles.button}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  center: { textAlign: 'center' },
  button: { marginTop: spacing.sm, minHeight: 48, justifyContent: 'center' },
});
