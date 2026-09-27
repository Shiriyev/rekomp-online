import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'cooking-timers';

let channelReady: Promise<void> | null = null;

function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Таймеры готовки',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 400],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  }).then(() => undefined);
  return channelReady;
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Schedules a local "timer finished" notification. Returns its id, or null when
 * notifications are not allowed (the in-app alert still works while the screen is open).
 */
export async function scheduleTimerEnd(
  title: string,
  body: string,
  seconds: number,
): Promise<string | null> {
  try {
    await ensureChannel();
    if (!(await ensurePermission())) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: CHANNEL_ID,
      },
    });
  } catch (e) {
    if (__DEV__) console.warn('Could not schedule timer notification', e);
    return null;
  }
}

export async function cancelTimerNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or removed.
  }
}

/** Foreground behaviour: the cooking screen alerts by itself, elsewhere show a banner. */
export function configureNotificationHandler(isCookScreenOpen: () => boolean): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const quiet = isCookScreenOpen();
      return {
        shouldShowBanner: !quiet,
        shouldShowList: true,
        shouldPlaySound: !quiet,
        shouldSetBadge: false,
      };
    },
  });
}
