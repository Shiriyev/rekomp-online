import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { BackupFormatError } from '@/db/backup';
import { showUndo } from '@/features/undo/undoStore';
import { useT, useTranslateMessage } from '@/i18n';
import { formatLongDate } from '@/lib/format';
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

/** Profile → «Данные»: backup to a JSON file, restore, reset. */
export function DataSection() {
  const t = useT();
  const translate = useTranslateMessage();
  const theme = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialogs>(null);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      showUndo(
        e instanceof BackupFormatError || e instanceof Error
          ? translate(e.message)
          : t('common.somethingWrong'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text variant="titleMedium" accessibilityRole="header">
        {t('backup.title')}
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {t('backup.privacy')}
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {t('backup.noPhotos')}
      </Text>
      <View style={styles.row}>
        <Button
          mode="contained-tonal"
          icon="export"
          disabled={busy}
          onPress={() => guard(exportAndShare)}
          style={styles.flex}>
          {t('backup.export')}
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
          {t('backup.import')}
        </Button>
      </View>
      <Button
        textColor={theme.colors.error}
        icon="delete-forever-outline"
        onPress={() => setDialog({ kind: 'reset1' })}>
        {t('backup.resetAll')}
      </Button>

      <Portal>
        <Dialog visible={dialog?.kind === 'import'} onDismiss={() => setDialog(null)}>
          <Dialog.Title>{t('backup.importTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {dialog?.kind === 'import'
                ? t('backup.importText', {
                    date:
                      dialog.picked.backup.exportedAt > 0
                        ? formatLongDate(dialog.picked.backup.exportedAt)
                        : t('backup.unknownDate'),
                    entries: dialog.picked.entries,
                  })
                : ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>{t('common.actions.cancel')}</Button>
            <Button
              mode="contained"
              onPress={() => {
                if (dialog?.kind !== 'import') return;
                const { backup } = dialog.picked;
                setDialog(null);
                void guard(async () => {
                  applyBackup(backup);
                  showUndo(t('backup.restored'));
                });
              }}>
              {t('backup.replace')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={dialog?.kind === 'reset1'} onDismiss={() => setDialog(null)}>
          <Dialog.Title>{t('backup.reset1Title')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('backup.reset1Text')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>{t('common.actions.cancel')}</Button>
            <Button textColor={theme.colors.error} onPress={() => setDialog({ kind: 'reset2' })}>
              {t('common.actions.continue')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={dialog?.kind === 'reset2'} onDismiss={() => setDialog(null)}>
          <Dialog.Title>{t('backup.reset2Title')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('backup.reset2Text')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialog(null)}>{t('backup.no')}</Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              onPress={() => {
                setDialog(null);
                resetEverything();
              }}>
              {t('backup.deleteAll')}
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
