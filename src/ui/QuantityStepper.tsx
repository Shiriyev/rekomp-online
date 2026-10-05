import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

import { useT } from '@/i18n';

type Props = {
  label: string;
  valueText: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
};

/** − value + with 48dp targets and spoken labels. */
export function QuantityStepper({
  label,
  valueText,
  onDecrement,
  onIncrement,
  decrementDisabled,
  incrementDisabled,
}: Props) {
  const t = useT();
  return (
    <View style={styles.row}>
      <IconButton
        icon="minus"
        mode="outlined"
        size={20}
        onPress={onDecrement}
        disabled={decrementDisabled}
        accessibilityLabel={t('ui.stepper.decrement', { label })}
      />
      <Text variant="titleSmall" style={styles.value} accessibilityLiveRegion="polite">
        {valueText}
      </Text>
      <IconButton
        icon="plus"
        mode="outlined"
        size={20}
        onPress={onIncrement}
        disabled={incrementDisabled}
        accessibilityLabel={t('ui.stepper.increment', { label })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: { minWidth: 64, textAlign: 'center' },
});
