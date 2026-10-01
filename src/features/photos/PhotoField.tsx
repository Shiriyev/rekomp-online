import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';

import { useT } from '@/i18n';
import { radius, spacing, useAppTheme } from '@/theme';

import { pickPhoto, type PhotoSource } from './mealPhotos';

type Props = {
  /** Current photo URI (a picked cache file or a stored photo), or null. */
  value: string | null;
  onChange: (uri: string | null) => void;
  /** False when the screen already shows the photo large (detail screen). */
  showPreview?: boolean;
};

/** Optional photo: a tile with «Снять / Галерея», then a wide preview to replace or remove. */
export function PhotoField({ value, onChange, showPreview = true }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState<{ source: PhotoSource; canAskAgain: boolean } | null>(null);
  const [failed, setFailed] = useState(false);

  const pick = async (source: PhotoSource) => {
    setBusy(true);
    setDenied(null);
    setFailed(false);
    try {
      const outcome = await pickPhoto(source);
      if (outcome.kind === 'picked') onChange(outcome.uri);
      else if (outcome.kind === 'denied') setDenied(outcome);
    } catch (e) {
      if (__DEV__) console.warn('Photo pick failed', e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const sourceButton = (source: PhotoSource) => {
    const label = t(source === 'camera' ? 'addMeal.photo.take' : 'addMeal.photo.pick');
    return (
      <Pressable
        key={source}
        onPress={() => void pick(source)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={label}
        android_ripple={{ color: theme.colors.primary }}
        style={[styles.source, { backgroundColor: theme.colors.elevation.level3 }]}>
        <MaterialCommunityIcons
          name={source === 'camera' ? 'camera-outline' : 'image-multiple-outline'}
          size={26}
          color={theme.colors.primary}
        />
        <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const overlayButton = (icon: string, label: string, onPress: () => void, color = '#FFFFFF') => (
    <IconButton
      icon={icon}
      mode="contained"
      containerColor="rgba(0,0,0,0.55)"
      iconColor={color}
      disabled={busy}
      onPress={onPress}
      accessibilityLabel={label}
    />
  );

  return (
    <View style={styles.container}>
      {value && showPreview ? (
        <View style={styles.previewBox}>
          <Image
            source={{ uri: value }}
            style={styles.preview}
            contentFit="cover"
            accessibilityLabel={t('addMeal.photo.preview')}
          />
          <View style={styles.overlay}>
            {overlayButton('camera-outline', t('addMeal.photo.retake'), () => void pick('camera'))}
            {overlayButton('image-outline', t('addMeal.photo.replace'), () => void pick('library'))}
            {overlayButton(
              'delete-outline',
              t('addMeal.photo.remove'),
              () => onChange(null),
              '#FFB4AB',
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.tile, { borderColor: theme.colors.outlineVariant }]}>
          {sourceButton('camera')}
          {sourceButton('library')}
          {value ? (
            <IconButton
              icon="delete-outline"
              mode="outlined"
              iconColor={theme.colors.error}
              disabled={busy}
              onPress={() => onChange(null)}
              accessibilityLabel={t('addMeal.photo.remove')}
            />
          ) : null}
        </View>
      )}
      {busy ? <ActivityIndicator accessibilityLabel={t('addMeal.photo.processing')} /> : null}
      {denied ? (
        <View style={styles.row}>
          <Text variant="bodySmall" style={[styles.flex, { color: theme.colors.error }]}>
            {t(
              denied.source === 'camera'
                ? 'addMeal.photo.deniedCamera'
                : 'addMeal.photo.deniedLibrary',
            )}{' '}
            {t(denied.canAskAgain ? 'addMeal.photo.askAgain' : 'addMeal.photo.openSettingsHint')}
          </Text>
          {!denied.canAskAgain ? (
            <Button compact onPress={() => void Linking.openSettings()}>
              {t('addMeal.photo.settings')}
            </Button>
          ) : null}
        </View>
      ) : null}
      {failed ? (
        <Text variant="bodySmall" style={{ color: theme.colors.error }}>
          {t('addMeal.photo.failed')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  source: {
    flex: 1,
    height: 84,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    overflow: 'hidden',
  },
  previewBox: { borderRadius: radius.lg, overflow: 'hidden' },
  preview: { width: '100%', aspectRatio: 16 / 10 },
  overlay: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    flexDirection: 'row',
  },
});
