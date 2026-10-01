import { create } from 'zustand';

/** Where the batch came from: adding at home, or ticking bought items in the shopping list. */
export type BulkSource = 'home' | 'shopping';

type BulkAddState = {
  source: BulkSource;
  /** Selected ingredient ids, in the order they were picked. */
  selected: string[];
  /** Amount per ingredient (ingredient unit); set when picked, edited on «Количество». */
  amounts: Record<string, number>;
  /** Shopping mode: the list item behind each ingredient. */
  shoppingItems: Record<string, string>;

  start: (source: BulkSource) => void;
  toggle: (ingredientId: string, defaultAmount: number, shoppingItemId?: string) => void;
  /** Adds (never toggles off), e.g. a product just created from the search. */
  select: (ingredientId: string, defaultAmount: number) => void;
  remove: (ingredientId: string) => void;
  setAmount: (ingredientId: string, amount: number) => void;
  clear: () => void;
};

const EMPTY = { selected: [], amounts: {}, shoppingItems: {} };

/** The batch being assembled across the selection and quantities screens. */
export const useBulkAddStore = create<BulkAddState>((set, get) => ({
  source: 'home',
  ...EMPTY,

  start: (source) => set({ source, ...EMPTY }),

  toggle: (ingredientId, defaultAmount, shoppingItemId) => {
    if (get().selected.includes(ingredientId)) {
      get().remove(ingredientId);
      return;
    }
    const { selected, amounts, shoppingItems } = get();
    set({
      selected: [...selected, ingredientId],
      amounts: { ...amounts, [ingredientId]: defaultAmount },
      shoppingItems: shoppingItemId
        ? { ...shoppingItems, [ingredientId]: shoppingItemId }
        : shoppingItems,
    });
  },

  select: (ingredientId, defaultAmount) => {
    if (get().selected.includes(ingredientId)) return;
    get().toggle(ingredientId, defaultAmount);
  },

  remove: (ingredientId) => {
    const { selected, amounts, shoppingItems } = get();
    const { [ingredientId]: _a, ...restAmounts } = amounts;
    const { [ingredientId]: _s, ...restItems } = shoppingItems;
    set({
      selected: selected.filter((id) => id !== ingredientId),
      amounts: restAmounts,
      shoppingItems: restItems,
    });
  },

  setAmount: (ingredientId, amount) =>
    set({ amounts: { ...get().amounts, [ingredientId]: amount } }),

  clear: () => set(EMPTY),
}));
