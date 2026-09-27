import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { BackupFormatError } from '@/db/backup';
import { showUndo } from '@/features/undo/undoStore';
import { spacing, useAppTheme } from '@/theme';

import {
  applyBackup,
  exportAndShare,
  pickBackup,
  resetEverything,
  type PickedBackup,
} from './backupActions';

type Dialogs =
  { kind: 'import'; picked: PickedBackup } | { kind: 'reset1' } | { kind: 'reset2' } | null;

const exportedDate = (ms: number) =>
  ms > 0
    ? new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'неизвестно';

/** Profile → «Данные»: backup to a JSON file, restore, reset. */
export function DataSection() {
  const theme = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialogs>(null);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      showUndo(
        e instanceof BackupFormatError || e instanceof Error ? e.message : 'Что-то пошло не так',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text variant="titleMedium" accessibilityRole="header">
        Данные
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Всё хранится только на телефоне. Бэкап — это файл с твоими данными (включая вес): храни его
        в надёжном месте.
      </Text>
      <View style={styles.row}>
        <Button
          mode="contained-tonal"
          icon="export"
          disabled={busy}
          onPress={() => guard(exportAndShare)}
          style={styles.flex}>
          Экспорт
        </Button>
        <Button
          mode="outlined"
          icon="import"
          disabled={busy}
          style={styles.flex}
          onPress={() =>
            guard(async () => {
              const picked = await pickBackup();
              if (picked) setDialog({ kind: 'import', picked });
            })
          }>
          Импорт
        </Button>
      </View>
      <Button
        textColor={theme.colors.error}
        icon="delete-forever-outline"
        onPress={() => setDialog({ kind: 'reset1' })}>
        Сбросить все данные
      </Button>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Фото блюд и продуктов — авторы Pexels (pexels.com), список в ATTRIBUTION.md.
      </Text>

      <Portal>
        <Dialog visible={dialog?.kind === 'import'} onDismiss={() => setDialog(null)}>
          <Dialog.Title>Восстановить из бэкапа?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {dialog?.kind === 'import'
                ? `Бэкап от ${exportedDate(dialog.picked.backup.exportedAt)}, записей еды: ${dialog.picked.entries}. Все текущие данные будут заменены.`
                : ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>Отмена</Button>
            <Button
              mode="contained"
              onPress={() => {
                if (dialog?.kind !== 'import') return;
                const { backup } = dialog.picked;
                setDialog(null);
                void guard(async () => {
                  applyBackup(backup);
                  showUndo('Данные восстановлены');
                });
              }}>
              Заменить
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={dialog?.kind === 'reset1'} onDismiss={() => setDialog(null)}>
          <Dialog.Title>Сбросить все данные?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Удалятся профиль, дневник, продукты, списки и каталог. Сначала можно сделать экспорт.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>Отмена</Button>
            <Button textColor={theme.colors.error} onPress={() => setDialog({ kind: 'reset2' })}>
              Продолжить
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={dialog?.kind === 'reset2'} onDismiss={() => setDialog(null)}>
          <Dialog.Title>Точно удалить всё?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Это нельзя отменить.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>Нет</Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              onPress={() => {
                setDialog(null);
                resetEverything();
              }}>
              Удалить всё
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
