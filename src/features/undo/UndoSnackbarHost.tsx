import { StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';

import { useT } from '@/i18n';

import { useUndoStore } from './undoStore';

export const UNDO_MS = 10_000;

/** One app-wide snackbar so an action on one screen can be undone after navigating. */
export function UndoSnackbarHost() {
  const t = useT();
  const current = useUndoStore((s) => s.current);
  const dismiss = useUndoStore((s) => s.dismiss);
  const undo = useUndoStore((s) => s.undo);

  return (
    <Snackbar
      key={current?.id}
      visible={current !== null}
      onDismiss={dismiss}
      duration={current?.run ? UNDO_MS : 3000}
      // Sits above the tab bar and the FAB (Material guidance).
      wrapperStyle={styles.wrapper}
      action={
        current?.run
          ? {
              label: t('common.actions.undo'),
              onPress: undo,
            }
          : undefined
      }>
      {current?.message}
    </Snackbar>
  );
}

// Clears the tab bar plus the Today FAB.
const styles = StyleSheet.create({ wrapper: { bottom: 160 } });
