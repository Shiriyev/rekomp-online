import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

import { HomeSegment } from '@/features/pantry/HomeSegment';
import { PortionsSegment } from '@/features/pantry/PortionsSegment';
import { ShoppingSegment } from '@/features/pantry/ShoppingSegment';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

type Segment = 'home' | 'portions' | 'shopping';

const SEGMENTS: Segment[] = ['home', 'portions', 'shopping'];

export default function PantryScreen() {
  const t = useT();
  const [segment, setSegment] = useState<Segment>('home');

  return (
    <View style={styles.flex}>
      <SegmentedButtons
        value={segment}
        onValueChange={(v) => setSegment(v as Segment)}
        buttons={SEGMENTS.map((value) => ({ value, label: t(`pantry.segments.${value}`) }))}
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
