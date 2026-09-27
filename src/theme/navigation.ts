import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

import { darkTheme, lightTheme, type AppTheme } from './index';

const toNavTheme = (base: Theme, app: AppTheme): Theme => ({
  ...base,
  dark: app.dark,
  colors: {
    ...base.colors,
    primary: app.colors.primary,
    background: app.colors.background,
    card: app.colors.elevation.level2,
    text: app.colors.onSurface,
    border: app.colors.outlineVariant,
    notification: app.colors.error,
  },
});

export const navLightTheme = toNavTheme(DefaultTheme, lightTheme);
export const navDarkTheme = toNavTheme(DarkTheme, darkTheme);
