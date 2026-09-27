import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput, type TextInputProps } from 'react-native-paper';

type Props<T extends FieldValues, TOut extends FieldValues> = {
  /** Control of a form whose resolver may transform values (input T, output TOut). */
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: string;
  suffix?: string;
  integer?: boolean;
  /** Custom native input, e.g. BottomSheetTextInput inside a bottom sheet. */
  render?: TextInputProps['render'];
};

/** Numeric text input bound to react-hook-form; parsing/validation is done by the zod schema. */
export function NumberField<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  name,
  label,
  suffix,
  integer,
  render,
}: Props<T, TOut>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <View style={styles.container}>
          <TextInput
            mode="outlined"
            label={label}
            accessibilityLabel={label}
            value={typeof value === 'string' ? value : ''}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType={integer ? 'number-pad' : 'decimal-pad'}
            right={suffix ? <TextInput.Affix text={suffix} /> : undefined}
            error={!!error}
            render={render}
          />
          {error ? (
            <HelperText type="error" padding="none">
              {error.message}
            </HelperText>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
