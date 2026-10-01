import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';

import { radius, spacing, useAppTheme } from '@/theme';

import { pickPhoto, type PhotoSource } from './mealPhotos';

type Props = {
  /** Current photo URI (a picked cache file or a stored photo), or null. */
  value: string | null;
  onChange: (uri: string | null) => void;
  label?: string;
  /** False when the screen already shows the photo large (detail screen). */
  showPreview?: boolean;
};

const DENIED_TEXT: Record<PhotoSource, string> = {
  camera: 'Нет доступа к камере.',
  library: 'Нет доступа к галерее.',
};

/** Optional photo: take one or pick from the gallery, preview, replace or remove. */
export function PhotoField({
  value,
  onChange,
  label = 'Фото (необязательно)',
  showPreview = true,
}: Props) {
  const theme = useAppTheme();
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

  return (
    <View style={styles.container}>
      <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      {value && showPreview ? (
        <View style={styles.previewRow}>
          <Image
            source={{ uri: value }}
            style={styles.preview}
            contentFit="cover"
            accessibilityLabel="Фото записи"
          />
          <View style={styles.previewActions}>
            <IconButton
              icon="camera-outline"
              mode="outlined"
              disabled={busy}
              onPress={() => void pick('camera')}
              accessibilityLabel="Переснять фото"
            />
            <IconButton
              icon="image-outline"
              mode="outlined"
              disabled={busy}
              onPress={() => void pick('library')}
              accessibilityLabel="Заменить фото из галереи"
            />
            <IconButton
              icon="delete-outline"
              mode="outlined"
              iconColor={theme.colors.error}
              disabled={busy}
              onPress={() => onChange(null)}
              accessibilityLabel="Удалить фото"
            />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Button
            mode="outlined"
            icon="camera-outline"
            disabled={busy}
            onPress={() => void pick('camera')}
            style={styles.flex}>
            Сфотографировать
          </Button>
          <Button
            mode="outlined"
            icon="image-outline"
            disabled={busy}
            onPress={() => void pick('library')}
            style={styles.flex}>
            Из галереи
          </Button>
          {value ? (
            <IconButton
              icon="delete-outline"
              mode="outlined"
              iconColor={theme.colors.error}
              disabled={busy}
              onPress={() => onChange(null)}
              accessibilityLabel="Удалить фото"
            />
          ) : null}
        </View>
      )}
      {busy ? <ActivityIndicator accessibilityLabel="Обработка фото" /> : null}
      {denied ? (
        <View style={styles.row}>
          <Text variant="bodySmall" style={[styles.flex, { color: theme.colors.error }]}>
            {DENIED_TEXT[denied.source]}{' '}
            {denied.canAskAgain
              ? 'Разреши доступ, чтобы добавить фото.'
              : 'Разреши доступ в настройках телефона.'}
          </Text>
          {!denied.canAskAgain ? (
            <Button compact onPress={() => void Linking.openSettings()}>
              Настройки
            </Button>
          ) : null}
        </View>
      ) : null}
      {failed ? (
        <Text variant="bodySmall" style={{ color: theme.colors.error }}>
          Не удалось обработать фото. Попробуй ещё раз.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  previewRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  preview: { width: 96, height: 96, borderRadius: radius.md },
  previewActions: { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },
});
