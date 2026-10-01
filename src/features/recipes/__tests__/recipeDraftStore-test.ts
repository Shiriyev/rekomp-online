import { clearRecipeDraft, useRecipeDraftStore } from '../recipeDraftStore';

const store = () => useRecipeDraftStore.getState();

beforeEach(() => useRecipeDraftStore.setState({ drafts: {} }));

describe('recipe draft store', () => {
  it('keeps drafts per recipe and drops values equal to the recipe', () => {
    store().setAmount('Z1', 'tvorog', 200, 250, 'g');
    store().setAmount('Z2', 'oats', 50, 60, 'g');
    expect(store().drafts).toEqual({ Z1: { tvorog: 200 }, Z2: { oats: 50 } });

    store().setAmount('Z1', 'tvorog', 250, 250, 'g');
    expect(store().drafts).toEqual({ Z2: { oats: 50 } });
  });

  it('«Сбросить к рецепту» clears one recipe only', () => {
    store().setAmount('Z1', 'banana', 0, 1, 'pcs');
    store().setAmount('Z2', 'oats', 50, 60, 'g');
    clearRecipeDraft('Z1');
    expect(store().drafts).toEqual({ Z2: { oats: 50 } });
  });
});
