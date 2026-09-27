import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { palette } from './tokens';

export type AppTheme = MD3Theme & {
  colors: MD3Theme['colors'] & { kcal: string; protein: string; warning: string; success: string };
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
    secondaryContainer: '#FFDBC9',
    onSecondaryContainer: '#331100',
    background: '#FAFDF7',
    surface: '#FAFDF7',
    kcal: palette.kcal.light,
    protein: palette.protein.light,
    warning: palette.warning.light,
    success: palette.success.light,
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
    secondaryContainer: '#7A3000',
    onSecondaryContainer: '#FFDBC9',
    background: '#121411',
    surface: '#121411',
    kcal: palette.kcal.dark,
    protein: palette.protein.dark,
    warning: palette.warning.dark,
    success: palette.success.dark,
  },
};

export { useAppTheme } from './useAppTheme';
export * from './tokens';
