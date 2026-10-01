import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, Portal, RadioButton, Text } from 'react-native-paper';

import { MAX_DAY_START_HOUR, MIN_DAY_START_HOUR } from '@/domain/day';
import { spacing } from '@/theme';

type Props = {
  current: number;
  onDismiss: () => void;
  /** Called only after the user confirms; re-files all entries. */
  onConfirm: (hour: number) => void;
};

const HOURS = Array.from(
  { length: MAX_DAY_START_HOUR - MIN_DAY_START_HOUR + 1 },
  (_, i) => MIN_DAY_START_HOUR + i,
);

export const dayStartLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/** Picks the hour the logical day starts; changing it re-files every entry after a confirm. */
export function DayStartDialog({ current, onDismiss, onConfirm }: Props) {
  const [hour, setHour] = useState(current);
  const [confirming, setConfirming] = useState(false);

  return (
    <Portal>
      <Dialog visible onDismiss={onDismiss}>
        <Dialog.Title>{confirming ? 'Пересчитать записи?' : 'Когда начинается день'}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          {confirming ? (
            <Text variant="bodyMedium">
              Новый день будет начинаться в {dayStartLabel(hour)}. Все записи еды перераспределятся
              по дням по этому правилу — итоги прошлых дней могут измениться.
            </Text>
          ) : (
            <>
              <Text variant="bodyMedium">
                Еда до этого часа считается во вчерашнем дне — поздний перекус после полуночи не
                попадёт в завтра.
              </Text>
              <ScrollView style={styles.list}>
                <RadioButton.Group value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                  {HOURS.map((h) => (
                    <RadioButton.Item
                      key={h}
                      value={String(h)}
                      label={h === 0 ? `${dayStartLabel(h)} (полночь)` : dayStartLabel(h)}
                      style={styles.item}
                    />
                  ))}
                </RadioButton.Group>
              </ScrollView>
            </>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={confirming ? () => setConfirming(false) : onDismiss}>
            {confirming ? 'Назад' : 'Отмена'}
          </Button>
          <Button
            mode="contained"
            disabled={!confirming && hour === current}
            onPress={() => (confirming ? onConfirm(hour) : setConfirming(true))}>
            {confirming ? 'Пересчитать' : 'Далее'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  list: { maxHeight: 320 },
  item: { minHeight: 48 },
});
