import { useEffect, useState } from 'react';

/** Epoch ms that re-renders the caller every `intervalMs` (for countdowns). */
export function useNow(intervalMs = 500, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}
