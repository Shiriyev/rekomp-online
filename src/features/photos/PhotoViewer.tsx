import { Zoomable } from '@likashefqet/react-native-image-zoom';
import { Image, type ImageSource } from 'expo-image';
import { Modal, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';

type Props = {
  source: ImageSource | number | null;
  onClose: () => void;
  accessibilityLabel?: string;
};

/** Full-screen photo with pinch / double-tap zoom; Android back closes it. */
export function PhotoViewer({ source, onClose, accessibilityLabel }: Props) {
  const t = useT();
  return (
    <Modal
      visible={source !== null}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      {/* Gestures inside a native Modal need their own root on Android. */}
      <GestureHandlerRootView style={styles.root}>
        {source !== null ? (
          <Zoomable
            minScale={1}
            maxScale={5}
            doubleTapScale={2.5}
            isDoubleTapEnabled
            style={styles.root}>
            <Image
              source={source}
              style={styles.root}
              contentFit="contain"
              accessibilityLabel={accessibilityLabel}
            />
          </Zoomable>
        ) : null}
        <SafeAreaView style={styles.close} edges={['top', 'right']} pointerEvents="box-none">
          <View>
            <IconButton
              icon="close"
              iconColor="#FFFFFF"
              containerColor="rgba(0,0,0,0.5)"
              size={28}
              onPress={onClose}
              accessibilityLabel={t('ui.photoViewer.close')}
            />
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  close: { position: 'absolute', top: 0, right: 0 },
});
