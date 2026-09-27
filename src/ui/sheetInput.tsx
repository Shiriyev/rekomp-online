import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { TextInputProps } from 'react-native-paper';

/** Paper TextInput `render` that keeps the bottom sheet above the keyboard. */
export const sheetInput: NonNullable<TextInputProps['render']> = (props) => (
  <BottomSheetTextInput {...props} />
);
