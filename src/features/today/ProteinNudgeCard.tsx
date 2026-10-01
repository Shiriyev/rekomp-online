import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';

import { useT } from '@/i18n';
import { formatInt } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

type Suggestion = { id: string; name: string; protein: number };
type Props = { grams: number; suggestions: Suggestion[] };

export function ProteinNudgeCard({ grams, suggestions }: Props) {
  const theme = useAppTheme();
  const t = useT();

  return (
    <Card mode="contained" style={{ backgroundColor: theme.colors.proteinContainer }}>
      <Card.Content style={styles.content}>
        <Text variant="titleMedium" style={{ color: theme.colors.onProteinContainer }}>
          {t('today.nudge.title', { grams: formatInt(grams) })}
        </Text>
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Chip
              key={s.id}
              icon="food-drumstick-outline"
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: s.id } })}>
              {t('today.nudge.suggestion', { name: s.name, protein: formatInt(s.protein) })}
            </Chip>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
