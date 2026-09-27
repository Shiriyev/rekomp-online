import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: theme.colors.elevation.level2 },
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
