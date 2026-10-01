import type { cooking as ru } from '../ru/cooking';
import type { Messages } from '../types';

export const cooking: Messages<typeof ru> = {
  overview: {
    first: 'First',
    middle: 'Then',
    last: 'Finally',
    withDuration: '{{lead}} {{duration}}',
    fromMinute: ' (from min {{minute}})',
    seconds: '{{value}} sec',
    minutes: '{{value}} min',
    total: 'Timers add up to ≈ {{minutes}} min (some steps can run in parallel).',
    toTaste: '{{name}} to taste',
    allDone: 'All done',
  },
};
