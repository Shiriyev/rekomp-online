import { eq } from 'drizzle-orm';

import { createLiveStore, deepEqual, tablesOf, type ChangeSource } from '../live';
import { ingredients, pantryItems } from '../schema';
import { createTestDb } from '../testing/createTestDb';

function setup() {
  const { db, close } = createTestDb();
  let emit: (table: string) => void = () => {};
  const changes: ChangeSource = (onChange) => {
    emit = onChange;
    return () => {};
  };
  const store = createLiveStore(changes);
  const addIngredient = (id: string) =>
    db
      .insert(ingredients)
      .values({
        id,
        name: id,
        category: 'dairy_eggs',
        unit: 'g',
        kcalPer100g: 1,
        proteinPer100g: 1,
      })
      .run();
  return {
    db,
    close: () => {
      store.dispose();
      close();
    },
    store,
    emit: (t: string) => emit(t),
    addIngredient,
  };
}

describe('live queries', () => {
  it('reads synchronously on first use', () => {
    const { db, close, store, addIngredient } = setup();
    addIngredient('a');
    const entry = store.acquire(db.select().from(ingredients));
    expect(entry.data).toHaveLength(1);
    close();
  });

  it('re-runs once for a burst of row changes and notifies once', () => {
    const { db, close, store, emit, addIngredient } = setup();
    const query = db.select().from(ingredients);
    const runs = jest.spyOn(query, 'all');
    const entry = store.acquire(query);
    const listener = jest.fn();
    store.subscribe(entry, listener);
    runs.mockClear();

    for (const id of ['a', 'b', 'c']) {
      addIngredient(id);
      emit('ingredients'); // SQLite reports every row
    }
    store.flush();

    expect(runs).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(entry.data).toHaveLength(3);
    close();
  });

  it('shares identical queries and keeps the same rows when nothing changed', () => {
    const { db, close, store, emit, addIngredient } = setup();
    addIngredient('a');
    const first = store.acquire(db.select().from(ingredients));
    const second = store.acquire(db.select().from(ingredients));
    expect(second).toBe(first);

    const listener = jest.fn();
    store.subscribe(first, listener);
    const before = first.data;
    emit('ingredients'); // e.g. a write that left these rows as they were
    store.flush();
    expect(listener).not.toHaveBeenCalled();
    expect(first.data).toBe(before);
    close();
  });

  it('ignores other tables and re-runs for joined tables', () => {
    const { db, close, store, emit } = setup();
    const join = db
      .select()
      .from(pantryItems)
      .innerJoin(ingredients, eq(ingredients.id, pantryItems.ingredientId));
    expect([...tablesOf(join)].sort()).toEqual(['ingredients', 'pantry_items']);

    const query = db.select().from(pantryItems);
    const runs = jest.spyOn(query, 'all');
    const entry = store.acquire(query);
    store.subscribe(entry, jest.fn());
    runs.mockClear();
    emit('meal_logs');
    store.flush();
    expect(runs).not.toHaveBeenCalled();
    close();
  });

  it('marks unwatched queries stale and refreshes them when watched again', () => {
    const { db, close, store, emit, addIngredient } = setup();
    const entry = store.acquire(db.select().from(ingredients));
    const unsubscribe = store.subscribe(entry, jest.fn());
    unsubscribe();
    addIngredient('a');
    emit('ingredients');
    store.flush();
    expect(entry.data).toHaveLength(0); // nobody watching: not re-run yet

    const listener = jest.fn();
    store.subscribe(entry, listener);
    expect(entry.data).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
    close();
  });
});

describe('deepEqual', () => {
  it('compares rows structurally', () => {
    expect(deepEqual([{ a: 1, tags: ['x'] }], [{ a: 1, tags: ['x'] }])).toBe(true);
    expect(deepEqual([{ a: 1, tags: ['x'] }], [{ a: 1, tags: ['y'] }])).toBe(false);
    expect(deepEqual([{ a: 1 }], [{ a: 1, b: null }])).toBe(false);
    expect(deepEqual(new Date(1), new Date(1))).toBe(true);
    expect(deepEqual([1], { 0: 1 })).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });
});
