import { useTranslation } from 'react-i18next';

import { currentLanguage, t } from '../index';
import { INGREDIENTS_EN, RECIPES_EN, TAGS_EN } from './en';

/** A catalog row: Russian `name`, English `nameEn` from the catalog (v1 rows may lack it). */
type Named = { id: string; name: string; nameEn?: string | null };

/** Dietary tags of catalog recipes (ids), translated through i18n. */
const RECIPE_TAG_IDS = new Set(['vegetarian', 'vegan', 'pork', 'alcohol', 'lactose', 'gluten']);

/**
 * Display names for built-in content in the current language. Russian returns the stored
 * text unchanged; English uses the catalog's English column, then the v1 English texts by
 * id, and falls back to the stored text.
 */
export const content = {
  recipeName: (r: Named): string =>
    (currentLanguage() === 'en' && (r.nameEn || RECIPES_EN[r.id]?.name)) || r.name,

  /** One-line description of a catalog recipe (v1 recipes have none). */
  recipeDescription: (r: {
    descriptionRu?: string | null;
    descriptionEn?: string | null;
  }): string | null =>
    (currentLanguage() === 'en' ? r.descriptionEn || r.descriptionRu : r.descriptionRu) ?? null,

  stepText: (recipeId: string, order: number, text: string, textEn?: string | null): string =>
    (currentLanguage() === 'en' && (textEn || RECIPES_EN[recipeId]?.steps[order - 1])) || text,

  lineNote: (
    recipeId: string,
    ingredientId: string,
    note: string | null,
    noteEn?: string | null,
  ): string | null =>
    note === null
      ? null
      : (currentLanguage() === 'en' && (noteEn || RECIPES_EN[recipeId]?.notes?.[ingredientId])) ||
        note,

  ingredientName: (i: Named): string =>
    (currentLanguage() === 'en' && (i.nameEn || INGREDIENTS_EN[i.id])) || i.name,

  tag: (tag: string): string =>
    RECIPE_TAG_IDS.has(tag)
      ? t(`recipes.tags.${tag}` as 'recipes.tags.vegan')
      : (currentLanguage() === 'en' && TAGS_EN[tag]) || tag,

  /** A diary line: dishes follow the language, manual entries stay as typed. */
  entryName: (log: { name: string; recipeId: string | null; source: string }): string =>
    log.source !== 'manual' && log.recipeId
      ? content.recipeName({ id: log.recipeId, name: log.name })
      : log.name,

  /** Russian and English names, so either finds a product in search. */
  searchAliases: (i: Named & { synonyms?: readonly string[] }): string[] => {
    const en = i.nameEn || INGREDIENTS_EN[i.id];
    return [...(en ? [en] : []), ...(i.synonyms ?? [])];
  },
};

/** `content` that re-renders the caller when the language changes. */
export function useContent(): typeof content {
  useTranslation();
  return content;
}
