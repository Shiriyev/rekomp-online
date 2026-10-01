import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInput as NativeTextInput,
  type TextInputProps,
} from 'react-native';
import { Text } from 'react-native-paper';

import { parseDecimal } from '@/domain/schemas';
import type { Unit } from '@/domain/types';
import { useUnitLabel } from '@/i18n';
import { radius, spacing, useAppTheme } from '@/theme';

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
  /** Highlights the pill (value differs from the recipe). */
  highlighted?: boolean;
  inputRef?: Ref<NativeTextInput>;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
};

/** Pill stepper «− 150 г +» with 48dp targets; the value can also be typed («82,5»). */
export function AmountInput({
  label,
  value,
  onChange,
  unit,
  step,
  min = 0,
  max = 100_000,
  highlighted = false,
  inputRef,
  returnKeyType,
  onSubmitEditing,
}: Props) {
  const theme = useAppTheme();
  const unitLabel = useUnitLabel();
  const [text, setText] = useState(toText(value));
  const [shown, setShown] = useState(value);
  const [focused, setFocused] = useState(false);
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

  const border = focused
    ? theme.colors.primary
    : highlighted
      ? theme.colors.primary
      : theme.colors.outlineVariant;

  const button = (icon: 'minus' | 'plus', disabled: boolean, onPress: () => void, a11y: string) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      android_ripple={{ color: theme.colors.primary, borderless: true, radius: 22 }}
      style={styles.button}>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={disabled ? theme.colors.onSurfaceDisabled : theme.colors.onSurface}
      />
    </Pressable>
  );

  return (
    <View
      style={[
        styles.pill,
        {
          borderColor: border,
          backgroundColor: highlighted
            ? theme.colors.primaryContainer
            : theme.colors.elevation.level2,
        },
      ]}>
      {button('minus', value <= min, () => set(value - step), `−: ${label}`)}
      <View style={styles.valueBox}>
        <TextInput
          ref={inputRef}
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
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setText(toText(value));
          }}
          keyboardType="decimal-pad"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          submitBehavior={onSubmitEditing ? 'submit' : undefined}
          selectTextOnFocus
          accessibilityLabel={label}
          style={[
            styles.input,
            { color: highlighted ? theme.colors.onPrimaryContainer : theme.colors.onSurface },
          ]}
          selectionColor={theme.colors.primary}
        />
        <Text
          variant="bodyMedium"
          style={{
            color: highlighted ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant,
          }}>
          {unitLabel(unit)}
        </Text>
      </View>
      {button('plus', value >= max, () => set(value + step), `+: ${label}`)}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
  },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  valueBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    minWidth: 84,
    gap: 4,
  },
  input: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 28,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
});
