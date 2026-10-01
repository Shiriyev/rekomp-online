import { create } from 'zustand';

import { setDraftAmount, type AmountMap } from '@/domain/recipeDraft';
import type { Unit } from '@/domain/types';

type DraftState = {
  /** recipeId → per-serving amounts that differ from the recipe. Empty = «как в рецепте». */
  drafts: Record<string, AmountMap>;
  setAmount: (
    recipeId: string,
    ingredientId: string,
    amount: number,
    baseAmount: number,
    unit: Unit,
  ) => void;
  reset: (recipeId: string) => void;
};

const NONE: AmountMap = {};

/**
 * Amounts edited on the recipe card: a draft of the current cook, not a recipe change.
 * Kept while moving between the card and the cooking mode; cleared after cooking or reset.
 */
export const useRecipeDraftStore = create<DraftState>((set, get) => ({
  drafts: {},
  setAmount: (recipeId, ingredientId, amount, baseAmount, unit) => {
    const next = setDraftAmount(
      get().drafts[recipeId] ?? NONE,
      ingredientId,
      amount,
      baseAmount,
      unit,
    );
    const { [recipeId]: _old, ...rest } = get().drafts;
    set({ drafts: Object.keys(next).length > 0 ? { ...rest, [recipeId]: next } : rest });
  },
  reset: (recipeId) => {
    const { [recipeId]: _old, ...rest } = get().drafts;
    set({ drafts: rest });
  },
}));

/** The draft of one recipe (stable empty object when there is none). */
export const useRecipeDraft = (recipeId: string): AmountMap =>
  useRecipeDraftStore((s) => s.drafts[recipeId] ?? NONE);

export const clearRecipeDraft = (recipeId: string) =>
  useRecipeDraftStore.getState().reset(recipeId);
