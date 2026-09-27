import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useState, type ReactNode, type RefObject } from 'react';
import { BackHandler, StyleSheet } from 'react-native';

import { spacing, useAppTheme } from '@/theme';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  /** Called each time the sheet opens from closed (reset forms here). */
  onOpen?: () => void;
  onClose?: () => void;
  children: ReactNode;
};

/** Themed, content-sized modal sheet; Android back closes it instead of the screen. */
export function AppBottomSheet({ sheetRef, onOpen, onClose, children }: Props) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      sheetRef.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [open, sheetRef]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.elevation.level1 }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
      onAnimate={(fromIndex, toIndex) => {
        if (fromIndex === -1 && toIndex >= 0) onOpen?.();
      }}
      onChange={(index) => setOpen(index >= 0)}
      onDismiss={() => {
        setOpen(false);
        onClose?.();
      }}>
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});
