import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import { repositories } from '@/db';
import { HomeSegment } from '@/features/pantry/HomeSegment';
import { PortionsSegment } from '@/features/pantry/PortionsSegment';
import { ShoppingSegment } from '@/features/pantry/ShoppingSegment';
import { useClock } from '@/lib/useClock';
import { spacing } from '@/theme';

type Segment = 'home' | 'portions' | 'shopping';

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'home', label: 'Дома' },
  { value: 'portions', label: 'Порции' },
  { value: 'shopping', label: 'Покупки' },
];

export default function PantryScreen() {
  const [segment, setSegment] = useState<Segment>('home');
  const { today } = useClock();

  // Expired sales are switched off whenever the tab is opened (and when the day rolls over).
  useFocusEffect(
    useCallback(() => {
      repositories.lidl.clearExpiredSales(today);
    }, [today]),
  );

  return (
    <View style={styles.flex}>
      <SegmentedButtons
        value={segment}
        onValueChange={(v) => setSegment(v as Segment)}
        buttons={SEGMENTS}
        density="small"
        style={styles.segments}
      />
      <View style={styles.flex}>
        {segment === 'home' ? <HomeSegment /> : null}
        {segment === 'portions' ? <PortionsSegment /> : null}
        {segment === 'shopping' ? <ShoppingSegment /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  segments: { marginHorizontal: spacing.lg, marginVertical: spacing.md },
});
