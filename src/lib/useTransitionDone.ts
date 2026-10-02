import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

/** If the navigator never reports the end (e.g. no animation), show the content anyway. */
const FALLBACK_MS = 450;

/**
 * False while the screen is sliding in, true once the push transition has finished.
 * Heavy screens render a still placeholder during the slide and their content after it:
 * mounting a full screen on the UI thread mid-animation is what drops frames.
 */
export function useTransitionDone(): boolean {
  const navigation = useNavigation();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setDone(true), FALLBACK_MS);
    // 'transitionEnd' is a native-stack event; other navigators simply never fire it.
    const unsubscribe = navigation.addListener(
      'transitionEnd' as never,
      ((e: { data?: { closing?: boolean } }) => {
        if (!e.data?.closing) setDone(true);
      }) as never,
    );
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [navigation, done]);
  return done;
}
