import { useTranslation } from 'react-i18next';

import { currentLanguage } from '../index';
import { INGREDIENTS_EN, RECIPES_EN, TAGS_EN } from './en';

type Named = { id: string; name: string };

/**
 * Display names for built-in content in the current language. Russian returns the stored
 * text unchanged; English looks up the seed id and falls back to the stored text.
 */
export const content = {
  recipeName: (r: Named): string =>
    (currentLanguage() === 'en' && RECIPES_EN[r.id]?.name) || r.name,

  stepText: (recipeId: string, order: number, text: string): string =>
    (currentLanguage() === 'en' && RECIPES_EN[recipeId]?.steps[order - 1]) || text,

  lineNote: (recipeId: string, ingredientId: string, note: string | null): string | null =>
    note === null
      ? null
      : (currentLanguage() === 'en' && RECIPES_EN[recipeId]?.notes?.[ingredientId]) || note,

  ingredientName: (i: Named): string =>
    (currentLanguage() === 'en' && INGREDIENTS_EN[i.id]) || i.name,

  tag: (tag: string): string => (currentLanguage() === 'en' && TAGS_EN[tag]) || tag,

  /** A diary line: dishes follow the language, manual entries stay as typed. */
  entryName: (log: { name: string; recipeId: string | null; source: string }): string =>
    log.source !== 'manual' && log.recipeId
      ? content.recipeName({ id: log.recipeId, name: log.name })
      : log.name,

  /** Russian and English names, so either finds a product in search. */
  searchAliases: (i: Named): string[] => {
    const en = INGREDIENTS_EN[i.id];
    return en ? [en] : [];
  },
};

/** `content` that re-renders the caller when the language changes. */
export function useContent(): typeof content {
  useTranslation();
  return content;
}
