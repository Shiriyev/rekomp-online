import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, Portal, RadioButton, Text } from 'react-native-paper';

import { MAX_DAY_START_HOUR, MIN_DAY_START_HOUR } from '@/domain/day';
import { useT } from '@/i18n';
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
  const t = useT();
  const [hour, setHour] = useState(current);
  const [confirming, setConfirming] = useState(false);

  return (
    <Portal>
      <Dialog visible onDismiss={onDismiss}>
        <Dialog.Title>
          {confirming
            ? t('profile.dayStartDialog.confirmTitle')
            : t('profile.dayStartDialog.title')}
        </Dialog.Title>
        <Dialog.Content style={styles.content}>
          {confirming ? (
            <Text variant="bodyMedium">
              {t('profile.dayStartDialog.confirmText', { time: dayStartLabel(hour) })}
            </Text>
          ) : (
            <>
              <Text variant="bodyMedium">{t('profile.dayStartDialog.hint')}</Text>
              <ScrollView style={styles.list}>
                <RadioButton.Group value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                  {HOURS.map((h) => (
                    <RadioButton.Item
                      key={h}
                      value={String(h)}
                      label={
                        h === 0
                          ? t('profile.dayStartDialog.midnight', { time: dayStartLabel(h) })
                          : dayStartLabel(h)
                      }
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
            {confirming ? t('common.actions.back') : t('common.actions.cancel')}
          </Button>
          <Button
            mode="contained"
            disabled={!confirming && hour === current}
            onPress={() => (confirming ? onConfirm(hour) : setConfirming(true))}>
            {confirming ? t('profile.recalculate') : t('common.actions.next')}
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
