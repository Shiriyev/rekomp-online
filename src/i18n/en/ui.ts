import type { ui as ru } from '../ru/ui';
import type { Messages } from '../types';

export const ui: Messages<typeof ru> = {
  stepper: {
    decrement: 'Less: {{label}}',
    increment: 'More: {{label}}',
  },
  photoViewer: {
    close: 'Close photo',
  },
  database: {
    errorTitle: 'Could not open your data',
    errorDescription: 'Restart the app. If the error comes back, restore your data from a backup.',
  },
};
