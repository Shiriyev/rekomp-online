import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Text } from 'react-native-paper';

import { spacing, useAppTheme } from '@/theme';

type Props = { onDelete: () => void; children: ReactNode; label?: string };

/**
 * Swipe left to delete. Screens also offer a visible delete action (e.g. in the edit sheet)
 * so the feature is reachable without the gesture.
 */
export function SwipeToDelete({ onDelete, children, label = 'Удалить' }: Props) {
  const theme = useAppTheme();

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={80}
      overshootRight={false}
      onSwipeableOpen={onDelete}
      renderRightActions={() => (
        <View style={[styles.action, { backgroundColor: theme.colors.errorContainer }]}>
          <MaterialCommunityIcons
            name="delete-outline"
            size={24}
            color={theme.colors.onErrorContainer}
          />
          <Text variant="labelLarge" style={{ color: theme.colors.onErrorContainer }}>
            {label}
          </Text>
        </View>
      )}>
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    flex: 1,
  },
});
