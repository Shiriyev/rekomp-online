import { repositories } from '@/db';
import type { UndoPreview } from '@/db/repositories/cookRepo';
import type { MealLog } from '@/db/schema';
import { releasePhoto } from '@/features/photos/mealPhotos';
import { showUndo } from '@/features/undo/undoStore';

/** What the delete dialog should offer for an entry. */
export type DeletePlan =
  | { kind: 'simple'; log: MealLog; message: string }
  | { kind: 'cooked'; log: MealLog; preview: UndoPreview }
  /** A manual entry that took products from «Дома»: offer to give them back. */
  | { kind: 'manualProducts'; log: MealLog; products: NonNullable<MealLog['pantryDelta']> };

export function planDelete(log: MealLog): DeletePlan {
  if (log.source === 'recipe' && log.cookSessionId) {
    return { kind: 'cooked', log, preview: repositories.cook.undoPreview(log.cookSessionId) };
  }
  if (log.source === 'manual' && log.pantryDelta && log.pantryDelta.length > 0) {
    return { kind: 'manualProducts', log, products: log.pantryDelta };
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

/** Undo of a delete: puts the entry back (and re-takes returned products); its photo stays. */
const restoreLater =
  (log: MealLog, productsReturned = false) =>
  () => {
    try {
      repositories.logs.restore(log, { productsReturned });
    } catch {
      showUndo('Вернуть запись нельзя: порция уже съедена', undefined, () =>
        releasePhoto(log.photoUri),
      );
    }
  };

/** The photo file is deleted only after the Undo window, and only if nothing restored it. */
const releaseLater = (log: MealLog) => () => releasePhoto(log.photoUri);

/** manual → delete (products it took go back home); portion → delete and put the portion back. */
export const deleteSimple = (log: MealLog) => {
  repositories.logs.undo(log.id);
  const returned = (log.pantryDelta?.length ?? 0) > 0;
  showUndo(
    returned ? `Удалено, продукты вернулись домой: ${log.name}` : `Удалено: ${log.name}`,
    restoreLater(log, returned),
    releaseLater(log),
  );
};

/** Cooked dish: undo the whole cook (products back home, its portions removed). */
export const deleteCookedWithProducts = (log: MealLog) => {
  if (!log.cookSessionId) return;
  const undone = repositories.cook.undo(log.cookSessionId);
  showUndo(
    `Удалено, продукты вернулись домой: ${log.name}`,
    undone ? () => repositories.cook.redo(undone) : undefined,
    releaseLater(log),
  );
};

/** Deletes just the line: products stay deducted, portions stay in the fridge. */
export const deleteEntryOnly = (log: MealLog) => {
  repositories.logs.removeEntryOnly(log.id);
  showUndo(`Удалено: ${log.name}`, restoreLater(log), releaseLater(log));
};
