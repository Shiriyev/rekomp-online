import { StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, ProgressBar, Text } from 'react-native-paper';

import type { CookTimer } from '@/db/schema';
import { formatTimer, isDone, isRunning, remainingSec } from '@/domain/cooking';
import { spacing, useAppTheme } from '@/theme';

type Props = {
  durationSec: number;
  timer: CookTimer | undefined;
  now: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
};

export function TimerCard({ durationSec, timer, now, onStart, onPause, onReset }: Props) {
  const theme = useAppTheme();
  const state = timer ?? { durationSec, startedAt: null, elapsedSec: 0 };
  const running = isRunning(state, now);
  const done = timer !== undefined && isDone(state, now);
  const left = remainingSec(state, now);
  const touched = timer !== undefined;

  return (
    <Card
      mode="contained"
      style={{
        backgroundColor: done ? theme.colors.primaryContainer : theme.colors.secondaryContainer,
      }}>
      <Card.Content style={styles.content}>
        <Text
          variant="displayMedium"
          style={styles.time}
          accessibilityRole="timer"
          accessibilityLiveRegion="polite"
          accessibilityLabel={done ? 'Таймер готов' : `Осталось ${formatTimer(left)}`}>
          {done ? 'Готово!' : formatTimer(left)}
        </Text>
        <ProgressBar
          progress={1 - left / durationSec}
          color={theme.colors.primary}
          style={styles.bar}
        />
        <View style={styles.row}>
          {running ? (
            <Button
              mode="contained"
              icon="pause"
              onPress={onPause}
              contentStyle={styles.big}
              style={styles.flex}>
              Пауза
            </Button>
          ) : (
            <Button
              mode="contained"
              icon="play"
              onPress={onStart}
              contentStyle={styles.big}
              style={styles.flex}>
              {done ? 'Ещё раз' : touched ? 'Продолжить' : 'Старт'}
            </Button>
          )}
          {touched ? (
            <IconButton
              icon="restore"
              mode="outlined"
              size={28}
              onPress={onReset}
              accessibilityLabel="Сбросить таймер"
            />
          ) : null}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, alignItems: 'stretch' },
  time: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  bar: { height: 6, borderRadius: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  big: { minHeight: 56 },
});
