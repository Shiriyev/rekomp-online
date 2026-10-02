import { useEffect, useState } from 'react';

/**
 * False on the first render, true from the next frame: lets a screen appear at once and
 * draw an expensive part (charts) right after, instead of holding the transition.
 */
export function useAfterFirstFrame(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return ready;
}
