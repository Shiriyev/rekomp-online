import { openBrowserAsync } from 'expo-web-browser';
import { ScrollView, StyleSheet } from 'react-native';
import { Card, IconButton, Text } from 'react-native-paper';

import { DATA_SOURCES, pexelsAuthorCount } from '@/features/about/sources';
import { useT } from '@/i18n';
import { spacing, useAppTheme } from '@/theme';

export default function AboutDataScreen() {
  const t = useT();
  const theme = useAppTheme();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="bodyLarge">{t('about.intro')}</Text>
      {DATA_SOURCES.map(({ id, url }) => {
        const title = t(`about.sources.${id}.title`);
        return (
          <Card key={id} mode="outlined">
            <Card.Title
              title={title}
              titleVariant="titleMedium"
              right={(props) => (
                <IconButton
                  {...props}
                  icon="open-in-new"
                  accessibilityLabel={t('about.open', { name: title })}
                  onPress={() => void openBrowserAsync(url)}
                />
              )}
            />
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t(`about.sources.${id}.body`, { count: pexelsAuthorCount })}
              </Text>
            </Card.Content>
          </Card>
        );
      })}
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {t('about.footer')}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
});
