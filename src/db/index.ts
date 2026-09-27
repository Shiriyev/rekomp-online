import { db } from './client';
import { createRepositories } from './repositories';

export { db };
/** App-wide repositories bound to the device database. */
export const repositories = createRepositories(db);
