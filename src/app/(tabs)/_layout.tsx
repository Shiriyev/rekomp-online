import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';

import { useAppTheme } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Сегодня', icon: 'silverware-fork-knife' },
  { name: 'pantry', title: 'Продукты', icon: 'fridge-outline' },
  { name: 'history', title: 'История', icon: 'chart-timeline-variant' },
  { name: 'profile', title: 'Профиль', icon: 'account-circle-outline' },
];

export default function TabsLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  // With the system navigation bar hidden the inset is 0, so the bar would sit on the very edge
  // of the screen (gesture area); keep a comfortable margin either way.
  const bottomPadding = Math.max(insets.bottom, 0) + 14;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.elevation.level2,
          height: 64 + bottomPadding,
          paddingTop: 8,
          paddingBottom: bottomPadding,
        },
        tabBarLabelStyle: { fontSize: 12, marginTop: 2 },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name={tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
