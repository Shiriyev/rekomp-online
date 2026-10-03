// expo-crypto is native; node's implementation is equivalent for tests.
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

// Reanimated/worklets need native runtimes; use the mocks they ship for tests.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated/mock'),
  // Not included in the shipped mock.
  useReducedMotion: () => false,
}));

// SQLite key-value store (remembered filters): in memory for tests.
jest.mock('expo-sqlite/kv-store', () => {
  const data = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItemSync: (key: string) => data.get(key) ?? null,
      setItemSync: (key: string, value: string) => void data.set(key, value),
      removeItemSync: (key: string) => data.delete(key),
    },
  };
});
