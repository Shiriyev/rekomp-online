import { create } from 'zustand';

type UndoEntry = { id: number; message: string; run?: () => void };

type UndoState = {
  current: UndoEntry | null;
  /** Shows a snackbar; with `run`, it offers «Отменить» for 10 s. */
  show: (message: string, run?: () => void) => void;
  dismiss: () => void;
};

let seq = 0;

export const useUndoStore = create<UndoState>((set) => ({
  current: null,
  show: (message, run) => set({ current: { id: ++seq, message, run } }),
  dismiss: () => set({ current: null }),
}));

export const showUndo = (message: string, run?: () => void) =>
  useUndoStore.getState().show(message, run);
