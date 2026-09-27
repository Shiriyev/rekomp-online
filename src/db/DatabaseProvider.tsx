import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { darkTheme, lightTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';

import { db } from './client';
import migrations from './migrations/migrations';
import { runSeed } from './seed/runSeed';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (e.g. fast refresh): nothing to do.
});

let seedOutcome: { ok: true } | { ok: false; error: unknown } | undefined;

/** Runs the (idempotent, synchronous) seed at most once per app process. */
function ensureSeeded() {
  if (!seedOutcome) {
    try {
      runSeed(db);
      seedOutcome = { ok: true };
    } catch (error) {
      seedOutcome = { ok: false, error };
    }
  }
  return seedOutcome;
}

/** Applies migrations and the seed before rendering the app; keeps the splash up meanwhile. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const migration = useMigrations(db, migrations);
  const seed = migration.success ? ensureSeeded() : undefined;
  const error = migration.error ?? (seed && !seed.ok ? seed.error : undefined);
  const ready = seed?.ok === true;
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    if (error && __DEV__) console.error('Database initialisation failed', error);
    if (error || ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [error, ready]);

  if (error) {
    return (
      <PaperProvider theme={isDark ? darkTheme : lightTheme}>
        <EmptyState
          icon="database-alert-outline"
          title="Не удалось открыть данные"
          description="Перезапустите приложение. Если ошибка повторится — восстановите данные из бэкапа."
        />
      </PaperProvider>
    );
  }
  return ready ? <>{children}</> : null;
}
