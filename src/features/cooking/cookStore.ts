import { create } from 'zustand';

import { repositories } from '@/db';
import type { ActiveSession, FinishOptions, FinishResult } from '@/db/repositories/cookRepo';
import type { CookProgress, CookTimer } from '@/db/schema';
import { t } from '@/i18n';
import { endsAt, isDone, pauseTimer, remainingSec, resetTimer, startTimer } from '@/domain/cooking';

import { cancelTimerNotification, scheduleTimerEnd } from './timerNotifications';

type Session = {
  id: string;
  recipeId: string;
  servings: number;
  choices: Record<string, string>;
  /** Per-serving amounts snapshot (edited on the recipe card). */
  amounts: Record<string, number>;
};

/** The card's draft, when cooking was started from the card (else the session keeps its own). */
type Draft = Readonly<Record<string, number>> | null;

type CookState = {
  session: Session | null;
  progress: CookProgress;
  /** Another recipe's unfinished session found when opening a new one. */
  conflict: ActiveSession | null;
  screenOpen: boolean;

  open: (
    recipeId: string,
    servings: number,
    choices: Record<string, string>,
    draft?: Draft,
  ) => void;
  startFresh: () => void;
  setScreenOpen: (open: boolean) => void;
  setStep: (index: number) => void;
  toggleChecked: (key: string) => void;
  startTimer: (stepOrder: number, durationSec: number, label: string) => void;
  pauseTimer: (stepOrder: number) => void;
  resetTimer: (stepOrder: number) => void;
  /** Leaves the screen but keeps the session resumable. */
  leave: () => void;
  abandon: () => void;
  finish: (options: FinishOptions) => FinishResult | null;
};

const EMPTY: CookProgress = { stepIndex: 0, checked: [], timers: [] };

let pendingOpen: {
  recipeId: string;
  servings: number;
  choices: Record<string, string>;
  draft: Draft;
} | null = null;

export const useCookStore = create<CookState>((set, get) => {
  const persist = (progress: CookProgress) => {
    const { session } = get();
    set({ progress });
    if (session) repositories.cook.saveProgress(session.id, progress);
  };

  const updateTimer = (stepOrder: number, fn: (t: CookTimer | undefined) => CookTimer | null) => {
    const { progress } = get();
    const others = progress.timers.filter((t) => t.stepOrder !== stepOrder);
    const next = fn(progress.timers.find((t) => t.stepOrder === stepOrder));
    persist({ ...progress, timers: next ? [...others, next] : others });
  };

  const cancelAll = () =>
    get().progress.timers.forEach((t) => void cancelTimerNotification(t.notificationId));

  const begin = (
    recipeId: string,
    servings: number,
    choices: Record<string, string>,
    draft: Draft,
  ) => {
    const s = repositories.cook.start(recipeId, servings, choices, Date.now(), draft ?? {});
    set({
      session: { id: s.id, recipeId, servings, choices, amounts: s.amountOverrides },
      progress: EMPTY,
      conflict: null,
    });
  };

  return {
    session: null,
    progress: EMPTY,
    conflict: null,
    screenOpen: false,

    open: (recipeId, servings, choices, draft = null) => {
      const current = get().session;
      if (current?.recipeId === recipeId) {
        // Back on the card, amounts were edited again: the running cook follows the draft.
        if (draft) {
          const updated = repositories.cook.setAmounts(current.id, draft);
          if (updated) set({ session: { ...current, amounts: updated.amountOverrides } });
        }
        return;
      }
      const active = repositories.cook.getActive();
      if (active?.recipeId === recipeId) {
        const session = draft ? (repositories.cook.setAmounts(active.id, draft) ?? active) : active;
        set({
          session: {
            id: active.id,
            recipeId,
            servings: active.servings,
            choices: active.choices,
            amounts: session.amountOverrides,
          },
          progress: active.progress ?? EMPTY,
          conflict: null,
        });
      } else if (active) {
        pendingOpen = { recipeId, servings, choices, draft };
        set({ conflict: active, session: null });
      } else {
        begin(recipeId, servings, choices, draft);
      }
    },

    startFresh: () => {
      if (!pendingOpen) return;
      const { recipeId, servings, choices, draft } = pendingOpen;
      pendingOpen = null;
      begin(recipeId, servings, choices, draft);
    },

    setScreenOpen: (screenOpen) => set({ screenOpen }),

    setStep: (index) => persist({ ...get().progress, stepIndex: Math.max(0, index) }),

    toggleChecked: (key) => {
      const { progress } = get();
      const checked = progress.checked.includes(key)
        ? progress.checked.filter((k) => k !== key)
        : [...progress.checked, key];
      persist({ ...progress, checked });
    },

    startTimer: (stepOrder, durationSec, label) => {
      const now = Date.now();
      const existing = get().progress.timers.find((t) => t.stepOrder === stepOrder);
      const base: CookTimer = existing ?? {
        stepOrder,
        durationSec,
        startedAt: null,
        elapsedSec: 0,
        notificationId: null,
      };
      const fresh = isDone(base, now) ? resetTimer(base) : base;
      const started = startTimer(fresh, now);
      updateTimer(stepOrder, () => ({ ...started, notificationId: null }));

      const end = endsAt(started);
      if (end === null) return;
      void scheduleTimerEnd(t('cooking.notification.title'), label, (end - now) / 1000).then(
        (notificationId) => {
          // Keep the id only if this run is still the current one.
          const current = get().progress.timers.find((t) => t.stepOrder === stepOrder);
          if (current && current.startedAt === started.startedAt) {
            updateTimer(stepOrder, (t) => (t ? { ...t, notificationId } : null));
          } else {
            void cancelTimerNotification(notificationId);
          }
        },
      );
    },

    pauseTimer: (stepOrder) => {
      updateTimer(stepOrder, (t) => {
        if (!t) return null;
        void cancelTimerNotification(t.notificationId);
        return { ...pauseTimer(t, Date.now()), notificationId: null };
      });
    },

    resetTimer: (stepOrder) => {
      updateTimer(stepOrder, (t) => {
        if (t) void cancelTimerNotification(t.notificationId);
        return null;
      });
    },

    leave: () => set({ session: null, progress: EMPTY, conflict: null }),

    abandon: () => {
      const { session } = get();
      cancelAll();
      if (session) repositories.cook.abandon(session.id);
      set({ session: null, progress: EMPTY, conflict: null });
    },

    finish: (options) => {
      const { session } = get();
      if (!session) return null;
      const result = repositories.cook.finish(session.id, options);
      cancelAll();
      set({ session: null, progress: EMPTY, conflict: null });
      return result;
    },
  };
});

/** Timers that are running or finished-but-not-reset, for the "other timers" bar. */
export const activeTimers = (timers: CookTimer[], now: number) =>
  timers.filter((t) => t.startedAt !== null || remainingSec(t, now) < t.durationSec);
