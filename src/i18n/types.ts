/** Same keys as the Russian source, any string values (plural suffixes may differ). */
export type Messages<T> = {
  [K in keyof T]: T[K] extends string ? string : Messages<T[K]>;
};
