import { StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

type Props = {
  label: string;
  valueText: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled?: boolean;
};

/** − value + with 48dp targets and spoken labels. */
export function QuantityStepper({
  label,
  valueText,
  onDecrement,
  onIncrement,
  decrementDisabled,
}: Props) {
  return (
    <View style={styles.row}>
      <IconButton
        icon="minus"
        mode="outlined"
        size={20}
        onPress={onDecrement}
        disabled={decrementDisabled}
        accessibilityLabel={`Меньше: ${label}`}
      />
      <Text variant="titleSmall" style={styles.value} accessibilityLiveRegion="polite">
        {valueText}
      </Text>
      <IconButton
        icon="plus"
        mode="outlined"
        size={20}
        onPress={onIncrement}
        accessibilityLabel={`Больше: ${label}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: { minWidth: 64, textAlign: 'center' },
});
