import { repositories } from '@/db';
import type { UndoPreview } from '@/db/repositories/cookRepo';
import type { MealLog } from '@/db/schema';

/** What the delete dialog should offer for an entry. */
export type DeletePlan =
  | { kind: 'simple'; log: MealLog; message: string }
  | { kind: 'cooked'; log: MealLog; preview: UndoPreview };

export function planDelete(log: MealLog): DeletePlan {
  if (log.source === 'recipe' && log.cookSessionId) {
    return { kind: 'cooked', log, preview: repositories.cook.undoPreview(log.cookSessionId) };
  }
  return {
    kind: 'simple',
    log,
    message:
      log.source === 'portion'
        ? 'Порция вернётся в «Готовые порции».'
        : 'Запись будет удалена из дневника.',
  };
}

/** manual → delete; portion → delete and put the portion back. */
export const deleteSimple = (log: MealLog) => repositories.logs.undo(log.id);

/** Cooked dish: undo the whole cook (products back home, its portions removed). */
export const deleteCookedWithProducts = (log: MealLog) => {
  if (log.cookSessionId) repositories.cook.undo(log.cookSessionId);
};

export const deleteCookedEntryOnly = (log: MealLog) =>
  repositories.logs.removeCookedEntryOnly(log.id);
