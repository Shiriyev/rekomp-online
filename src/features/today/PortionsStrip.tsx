import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import type { AvailablePortion } from '@/db/repositories/portionsRepo';
import { formatInt, formatKcal } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

type Props = { portions: AvailablePortion[]; onEat: (portion: AvailablePortion) => void };

/** "Готово в холодильнике": tap a container to eat one portion. */
export function PortionsStrip({ portions, onEat }: Props) {
  const theme = useAppTheme();
  if (portions.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" accessibilityRole="header">
        Готово в холодильнике
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {portions.map((p) => (
          <Card
            key={p.id}
            mode="outlined"
            style={styles.card}
            onPress={() => onEat(p)}
            accessibilityHint="Съесть одну порцию"
            accessibilityLabel={`${p.recipeName}, осталось ${p.portionsLeft}`}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleSmall" numberOfLines={2}>
                {p.recipeName} ×{p.portionsLeft}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatKcal(p.kcalPerPortion)} · {formatInt(p.proteinPerPortion)} г белка
              </Text>
              <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                Съесть порцию
              </Text>
            </Card.Content>
          </Card>
        ))}
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
