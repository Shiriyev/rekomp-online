import { useMemo } from 'react';

import { useDayLogs, useProfile } from '@/db/hooks';
import { summarizeDay } from '@/domain/today';
import { useClock } from '@/lib/useClock';

/** kcal still available today (negative when over). */
export function useKcalLeftToday(): number {
  const { today } = useClock();
  const { profile } = useProfile();
  const logs = useDayLogs(today);
  return useMemo(
    () => (profile?.kcalTarget ?? 0) - summarizeDay(logs).total.kcal,
    [logs, profile?.kcalTarget],
  );
}
