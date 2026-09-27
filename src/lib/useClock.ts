import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toLocalDate } from '@/domain/dates';

/**
 * Current time, refreshed every minute and whenever the app returns to the foreground,
 * so day boundaries (midnight) and time-of-day hints stay correct.
 */
export function useClock(intervalMs = 60_000): { now: Date; today: string } {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, intervalMs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [intervalMs]);

  return { now, today: toLocalDate(now.getTime()) };
}
