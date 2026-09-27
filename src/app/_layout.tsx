import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/db/DatabaseProvider';
import { useProfile, useThemePreference } from '@/db/hooks';
import { useCookStore } from '@/features/cooking/cookStore';
import { configureNotificationHandler } from '@/features/cooking/timerNotifications';
import { UndoSnackbarHost } from '@/features/undo/UndoSnackbarHost';
import { darkTheme, lightTheme } from '@/theme';
import { navDarkTheme, navLightTheme } from '@/theme/navigation';

// Timer notifications stay quiet while the cooking screen shows its own alert.
configureNotificationHandler(() => useCookStore.getState().screenOpen);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Immersive: system buttons stay hidden; swipe up from the edge shows them temporarily. */}
        <NavigationBar hidden />
        <DatabaseProvider>
          <AppShell />
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const preference = useThemePreference();
  const system = useColorScheme();
  const isDark = preference === 'system' ? system === 'dark' : preference === 'dark';
  const { profile, isLoaded } = useProfile();

  if (!isLoaded) return null;
  const hasProfile = profile !== undefined;

  return (
    <PaperProvider theme={isDark ? darkTheme : lightTheme}>
      <ThemeProvider value={isDark ? navDarkTheme : navLightTheme}>
        <BottomSheetModalProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={hasProfile}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="edit-profile"
                options={{ headerShown: true, title: 'Данные и цели' }}
              />
              <Stack.Screen
                name="recipes/[mealType]"
                options={{ headerShown: true, title: 'Блюда' }}
              />
              <Stack.Screen name="recipe/[id]" options={{ headerShown: true, title: 'Блюдо' }} />
              <Stack.Screen
                name="cook/[id]"
                options={{ headerShown: false, gestureEnabled: false }}
              />
            </Stack.Protected>
            <Stack.Protected guard={!hasProfile}>
              <Stack.Screen name="onboarding/index" />
            </Stack.Protected>
          </Stack>
          <UndoSnackbarHost />
        </BottomSheetModalProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}
