/**
 * Default fridge life of a cooked dish (FIXES_v2.1 task 2): a pot dish keeps ~3 days, a
 * salad, an omelette or anything not cooked ~1 day. A starting point for the reviewer;
 * the steps rewrite (task 4) and recipe-overrides.json can set the real value.
 */
import { config } from '../../pipeline.config.ts';
import { isNoCook, type Equipment } from './equipment.ts';

export function defaultStorageDays(nameEn: string, equipment: readonly Equipment[]): number {
  const { shortWords, short, long } = config.storage;
  if (shortWords.test(nameEn) || isNoCook(equipment)) return short;
  return long;
}
