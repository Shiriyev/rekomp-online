import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useProfile } from '@/db/hooks';
import {
  DEFAULT_DAY_START_HOUR,
  deviceTimeZone,
  getLogicalDate,
  msUntilNextDayStart,
} from '@/domain/day';

/**
 * Current time and the logical day («Сегодня» switches at the profile's day start, 04:00 by
 * default). Refreshed every minute, when the app returns to the foreground and exactly at
 * the next day start, so a screen left open overnight rolls over on time.
 */
export function useClock(intervalMs = 60_000): { now: Date; today: string; dayStartHour: number } {
  const { profile } = useProfile();
  const dayStartHour = profile?.dayStartHour ?? DEFAULT_DAY_START_HOUR;
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

  useEffect(() => {
    // A little past the boundary so the new day is already current when it fires.
    const delay = msUntilNextDayStart(Date.now(), dayStartHour) + 1_000;
    const timer = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(timer);
  }, [now, dayStartHour]);

  return {
    now,
    today: getLogicalDate(now.getTime(), dayStartHour, deviceTimeZone()),
    dayStartHour,
  };
}
