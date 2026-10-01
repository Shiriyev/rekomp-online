import { useBulkAddStore } from '../bulkAddStore';

const store = () => useBulkAddStore.getState();

beforeEach(() => store().start('home'));

describe('bulk add store', () => {
  it('keeps the selection in pick order with default amounts', () => {
    store().toggle('tvorog', 250);
    store().toggle('egg', 10);
    expect(store().selected).toEqual(['tvorog', 'egg']);
    expect(store().amounts).toEqual({ tvorog: 250, egg: 10 });
  });

  it('toggles off and removes amounts', () => {
    store().toggle('tvorog', 250);
    store().setAmount('tvorog', 300);
    store().toggle('tvorog', 250);
    expect(store().selected).toEqual([]);
    expect(store().amounts).toEqual({});
  });

  it('select never toggles off (new product from search)', () => {
    store().select('custom_1', 100);
    store().select('custom_1', 100);
    expect(store().selected).toEqual(['custom_1']);
  });

  it('remembers shopping items and resets on start', () => {
    store().start('shopping');
    store().toggle('tvorog', 250, 'item-1');
    expect(store().shoppingItems).toEqual({ tvorog: 'item-1' });
    store().remove('tvorog');
    expect(store().shoppingItems).toEqual({});
    store().toggle('egg', 10, 'item-2');
    store().clear();
    expect(store()).toMatchObject({ selected: [], amounts: {}, shoppingItems: {} });
    store().start('home');
    expect(store().source).toBe('home');
  });
});
