import type { catalog as ru } from '../ru/catalog';
import type { Messages } from '../types';

export const catalog: Messages<typeof ru> = {
  unsupported: {
    title: 'These products are no longer supported',
    text: 'The updated catalog has no match for them. They stay in your history and at home, but are no longer offered when you add products.',
    ok: 'Got it',
  },
};
