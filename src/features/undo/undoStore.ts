import { create } from 'zustand';

type UndoEntry = {
  id: number;
  message: string;
  run?: () => void;
  /** Runs once the action can no longer be undone (timeout, dismissed or replaced). */
  onExpire?: () => void;
};

type UndoState = {
  current: UndoEntry | null;
  /** Shows a snackbar; with `run`, it offers «Отменить» for 10 s. */
  show: (message: string, run?: () => void, onExpire?: () => void) => void;
  /** «Отменить» pressed: runs the undo, never the expiry. */
  undo: () => void;
  /** Closed without undo: the action is final. */
  dismiss: () => void;
};

let seq = 0;

const expire = (entry: UndoEntry | null) => {
  try {
    entry?.onExpire?.();
  } catch (e) {
    if (__DEV__) console.warn('Undo expiry failed', e);
  }
};

export const useUndoStore = create<UndoState>((set, get) => ({
  current: null,
  show: (message, run, onExpire) => {
    const previous = get().current;
    set({ current: { id: ++seq, message, run, onExpire } });
    // Only one snackbar at a time: the replaced action becomes final.
    expire(previous);
  },
  undo: () => {
    const entry = get().current;
    set({ current: null });
    entry?.run?.();
  },
  dismiss: () => {
    const entry = get().current;
    set({ current: null });
    expire(entry);
  },
}));

export const showUndo = (message: string, run?: () => void, onExpire?: () => void) =>
  useUndoStore.getState().show(message, run, onExpire);
