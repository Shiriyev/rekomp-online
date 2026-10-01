import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import type { AvailablePortion } from '@/db/repositories/portionsRepo';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatInt, formatKcal } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

type Props = { portions: AvailablePortion[]; onEat: (portion: AvailablePortion) => void };

/** "Готово в холодильнике": tap a container to eat one portion. */
export function PortionsStrip({ portions, onEat }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const c = useContent();
  if (portions.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" accessibilityRole="header">
        {t('today.portions.title')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {portions.map((p) => {
          const name = c.recipeName({ id: p.recipeId, name: p.recipeName });
          return (
            <Card
              key={p.id}
              mode="outlined"
              style={styles.card}
              onPress={() => onEat(p)}
              accessibilityHint={t('today.portions.eatHint')}
              accessibilityLabel={t('today.portions.a11y', { name, count: p.portionsLeft })}>
              <Card.Content style={styles.cardContent}>
                <Text variant="titleSmall" numberOfLines={2}>
                  {name} ×{p.portionsLeft}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('today.portions.meta', {
                    kcal: formatKcal(p.kcalPerPortion),
                    protein: formatInt(p.proteinPerPortion),
                  })}
                </Text>
                <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                  {t('today.portions.eat')}
                </Text>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { gap: spacing.md },
  card: { width: 220 },
  cardContent: { gap: spacing.xs, paddingVertical: spacing.md },
});
