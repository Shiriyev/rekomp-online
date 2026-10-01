import { useState, type Ref } from 'react';
import { StyleSheet, View, type TextInput as NativeTextInput } from 'react-native';
import { IconButton, TextInput, type TextInputProps } from 'react-native-paper';

import { parseDecimal } from '@/domain/schemas';
import type { Unit } from '@/domain/types';

const UNIT_LABELS: Record<Unit, string> = { g: 'г', ml: 'мл', pcs: 'шт' };

const toText = (n: number) => String(n).replace('.', ',');

type Props = {
  /** Spoken name of what is being changed, e.g. «Творог». */
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit: Unit;
  step: number;
  min?: number;
  max?: number;
  /** BottomSheetTextInput inside sheets. */
  render?: TextInputProps['render'];
  inputRef?: Ref<NativeTextInput>;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
};

/** − [typed amount] + with 48dp targets; typing accepts «82,5». */
export function AmountInput({
  label,
  value,
  onChange,
  unit,
  step,
  min = 0,
  max = 100_000,
  render,
  inputRef,
  returnKeyType,
  onSubmitEditing,
}: Props) {
  const [text, setText] = useState(toText(value));
  const [shown, setShown] = useState(value);
  // Follow changes made from outside (stepper, reset) without fighting the user's typing.
  if (value !== shown) {
    setShown(value);
    setText(toText(value));
  }

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = (n: number) => {
    const next = Math.round(clamp(n) * 100) / 100;
    setShown(next);
    setText(toText(next));
    onChange(next);
  };

  return (
    <View style={styles.row}>
      <IconButton
        icon="minus"
        mode="outlined"
        size={20}
        disabled={value <= min}
        onPress={() => set(value - step)}
        accessibilityLabel={`Меньше: ${label}`}
      />
      <TextInput
        ref={inputRef}
        mode="outlined"
        dense
        value={text}
        onChangeText={(t) => {
          setText(t);
          const n = parseDecimal(t);
          if (Number.isFinite(n)) {
            const next = clamp(n);
            setShown(next);
            onChange(next);
          }
        }}
        onBlur={() => setText(toText(value))}
        keyboardType="decimal-pad"
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        submitBehavior={onSubmitEditing ? 'submit' : undefined}
        right={<TextInput.Affix text={UNIT_LABELS[unit]} />}
        style={styles.input}
        accessibilityLabel={`Количество: ${label}`}
        render={render}
        selectTextOnFocus
      />
      <IconButton
        icon="plus"
        mode="outlined"
        size={20}
        disabled={value >= max}
        onPress={() => set(value + step)}
        accessibilityLabel={`Больше: ${label}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { width: 104, textAlign: 'right' },
});
