import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, List, Text } from 'react-native-paper';

import { DATA_SOURCES, PHOTOGRAPHERS } from '@/features/about/sources';
import { useT } from '@/i18n';
import { spacing, useAppTheme } from '@/theme';

const open = (url: string) => void openBrowserAsync(url);

export default function AboutDataScreen() {
  const t = useT();
  const theme = useAppTheme();
  const [authorsOpen, setAuthorsOpen] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="bodyLarge">{t('about.intro')}</Text>
      {DATA_SOURCES.map(({ id, url }) => {
        const title = t(`about.sources.${id}.title`);
        return (
          <Card key={id} mode="outlined">
            <Card.Content style={styles.card}>
              <View style={styles.cardText}>
                <Text variant="titleMedium">{title}</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t(`about.sources.${id}.body`)}
                </Text>
              </View>
              <IconButton
                icon="open-in-new"
                accessibilityLabel={t('about.open', { name: title })}
                onPress={() => open(url)}
              />
            </Card.Content>
          </Card>
        );
      })}

      {/* Not a Card: Paper's Card clipped the list when it grew after layout. */}
      <View
        style={[
          styles.authors,
          { borderColor: theme.colors.outline, borderRadius: theme.roundness * 3 },
        ]}>
        <List.Item
          title={t('about.photographers', { count: PHOTOGRAPHERS.length })}
          left={(props) => <List.Icon {...props} icon="camera-outline" />}
          right={(props) => (
            <List.Icon {...props} icon={authorsOpen ? 'chevron-up' : 'chevron-down'} />
          )}
          onPress={() => setAuthorsOpen((v) => !v)}
          accessibilityState={{ expanded: authorsOpen }}
        />
        {authorsOpen ? (
          <View style={styles.authorList}>
            {PHOTOGRAPHERS.map((p) => (
              <Pressable
                key={p.name}
                disabled={!p.url}
                onPress={() => p.url && open(p.url)}
                accessibilityRole={p.url ? 'link' : 'text'}
                android_ripple={{ color: theme.colors.surfaceVariant }}
                style={styles.author}>
                <Text
                  variant="bodyMedium"
                  style={{ flex: 1, color: p.url ? theme.colors.primary : theme.colors.onSurface }}>
                  {p.name}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('about.photoCount', { count: p.photos })}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardText: { flex: 1, gap: spacing.xs },
  authors: { borderWidth: 1, overflow: 'hidden' },
  authorList: { paddingBottom: spacing.sm },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
});
