import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { palette } from './tokens';

export type AppTheme = MD3Theme & {
  colors: MD3Theme['colors'] & {
    kcal: string;
    protein: string;
    warning: string;
    success: string;
    /** Warm accent surface for protein hints (the nudge card). */
    proteinContainer: string;
    onProteinContainer: string;
  };
};

export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2E7D32',
    onPrimary: '#FFFFFF',
    primaryContainer: '#B8F0B9',
    onPrimaryContainer: '#002106',
    secondary: '#E65100',
    // Tonal green-grey for chips, selected segments and tonal buttons (M3 secondary).
    secondaryContainer: '#D5E8D0',
    onSecondaryContainer: '#101F10',
    surfaceVariant: '#DEE5D8',
    outlineVariant: '#C2C9BD',
    background: '#FAFDF7',
    surface: '#FAFDF7',
    kcal: palette.kcal.light,
    protein: palette.protein.light,
    warning: palette.warning.light,
    success: palette.success.light,
    proteinContainer: '#FFDBC9',
    onProteinContainer: '#331100',
  },
};

export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#9CD69D',
    onPrimary: '#00390F',
    primaryContainer: '#0F5219',
    onPrimaryContainer: '#B8F0B9',
    secondary: '#FFB68E',
    secondaryContainer: '#3A4B39',
    onSecondaryContainer: '#D5E8D0',
    surfaceVariant: '#424940',
    outlineVariant: '#424940',
    background: '#121411',
    surface: '#121411',
    kcal: palette.kcal.dark,
    protein: palette.protein.dark,
    warning: palette.warning.dark,
    success: palette.success.dark,
    proteinContainer: '#4A2A12',
    onProteinContainer: '#FFDBC9',
  },
};

export { useAppTheme } from './useAppTheme';
export * from './tokens';
