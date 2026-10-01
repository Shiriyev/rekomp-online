import { repositories } from '@/db';
import type { UndoPreview } from '@/db/repositories/cookRepo';
import type { MealLog } from '@/db/schema';
import { releasePhoto } from '@/features/photos/mealPhotos';
import { showUndo } from '@/features/undo/undoStore';

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

/** Undo of a delete: puts the entry back; its photo stays. */
const restoreLater = (log: MealLog) => () => {
  try {
    repositories.logs.restore(log);
  } catch {
    showUndo('Вернуть запись нельзя: порция уже съедена', undefined, () =>
      releasePhoto(log.photoUri),
    );
  }
};

/** The photo file is deleted only after the Undo window, and only if nothing restored it. */
const releaseLater = (log: MealLog) => () => releasePhoto(log.photoUri);

/** manual → delete; portion → delete and put the portion back. */
export const deleteSimple = (log: MealLog) => {
  repositories.logs.undo(log.id);
  showUndo(`Удалено: ${log.name}`, restoreLater(log), releaseLater(log));
};

/** Cooked dish: undo the whole cook (products back home, its portions removed). */
export const deleteCookedWithProducts = (log: MealLog) => {
  if (!log.cookSessionId) return;
  repositories.cook.undo(log.cookSessionId);
  showUndo(`Удалено, продукты вернулись домой: ${log.name}`, undefined, releaseLater(log));
};

export const deleteCookedEntryOnly = (log: MealLog) => {
  repositories.logs.removeCookedEntryOnly(log.id);
  showUndo(`Удалено: ${log.name}`, restoreLater(log), releaseLater(log));
};
