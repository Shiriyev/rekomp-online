/** Design tokens shared by light and dark themes. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

/** Brand palette: fresh green for kcal, warm orange for protein. */
export const palette = {
  kcal: { light: '#2E7D32', dark: '#81C784' },
  protein: { light: '#E65100', dark: '#FFB74D' },
  warning: { light: '#B26A00', dark: '#FFCC80' },
  success: { light: '#1B5E20', dark: '#A5D6A7' },
} as const;
