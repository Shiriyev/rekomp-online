import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';

import { useT } from '@/i18n';
import { useAppTheme } from '@/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: { name: string; key: 'today' | 'pantry' | 'history' | 'profile'; icon: IconName }[] = [
  { name: 'index', key: 'today', icon: 'silverware-fork-knife' },
  { name: 'pantry', key: 'pantry', icon: 'fridge-outline' },
  { name: 'history', key: 'history', icon: 'chart-timeline-variant' },
  { name: 'profile', key: 'profile', icon: 'account-circle-outline' },
];

export default function TabsLayout() {
  const theme = useAppTheme();
  const t = useT();
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
            title: t(`nav.tabs.${tab.key}`),
            tabBarAccessibilityLabel: t(`nav.tabs.${tab.key}`),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name={tab.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
