import { randomUUID } from 'expo-crypto';

/** RFC 4122 v4 id used for rows and idempotency keys. */
export const newId = (): string => randomUUID();
