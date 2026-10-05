import { StyleSheet, View } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';

import { repositories } from '@/db';
import { useHiddenRecipes } from '@/db/hooks';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { spacing, useAppTheme } from '@/theme';

/** Profile: the dishes hidden with «Скрыть это блюдо», each with «Вернуть». */
export function HiddenRecipesSection() {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const hidden = useHiddenRecipes();
  if (hidden.length === 0) return null;

  return (
    <Card mode="outlined">
      <Card.Content style={styles.gap}>
        <Text variant="titleMedium" accessibilityRole="header">
          {t('profile.hidden.title', { count: hidden.length })}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('profile.hidden.hint')}
        </Text>
        {hidden.map((r, i) => {
          const name = content.recipeName(r);
          return (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <Text variant="bodyLarge" style={styles.flex} numberOfLines={2}>
                  {name}
                </Text>
                <Button
                  compact
                  icon="eye-outline"
                  onPress={() => repositories.recipes.unhide(r.id)}
                  accessibilityLabel={t('profile.hidden.restoreA11y', { name })}>
                  {t('profile.hidden.restore')}
                </Button>
              </View>
            </View>
          );
        })}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
});
