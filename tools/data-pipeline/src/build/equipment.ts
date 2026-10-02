/**
 * Kitchen equipment a recipe needs, read from its English steps, for the «нет плиты /
 * нет духовки / нет блендера» filters. Keywords, not a model: the result is reproducible
 * and reviewable. A recipe that needs none of the heat sources is «no cooking».
 */
import { EQUIPMENT, HEAT_SOURCES, type Equipment } from '../lib/app.ts';

export type { Equipment };

const RULES: Record<Equipment, RegExp> = {
  oven: /\b(oven|bake[sd]?|baking|roast(ed|ing)?|broil\w*|gratin|preheat\w*)\b/i,
  grill: /\b(grill\w*|griddle|barbecue|bbq|chargrill\w*)\b/i,
  microwave: /\bmicrowav\w*\b/i,
  multicooker: /\b(pressure cooker|instant pot|slow cooker|multicooker|crock ?pot)\b/i,
  blender:
    /\b(blend\w*|food processor|processor|pur[eé]e[ds]?|liquidi[sz]e|smoothie|hand mixer|stick blender)\b/i,
  mixer:
    /\b(electric (mixer|whisk|beaters?)|stand mixer|mixer|whip\w*|beat\w* .{0,40}(stiff|fluffy|peaks))\b/i,
  stove:
    /\b(pan|skillet|wok|saucepan|pot|boil\w*|simmer\w*|fry|fries|fried|frying|stir-?fr\w*|saut[eé]\w*|sear\w*|poach\w*|steam\w*|stew\w*|hob|stove\w*|heat (the |some |a little )?(oil|butter|ghee|water|milk|stock|broth))\b/i,
};

/** Equipment the steps mention; a «grill pan» or «baking sheet in the oven» counts once. */
export function detectEquipment(steps: readonly string[]): Equipment[] {
  const text = steps.join('\n');
  const found = EQUIPMENT.filter((e) => RULES[e].test(text));
  // «Griddle pan» / «grill pan» on the hob is a stove job, not a barbecue.
  if (
    found.includes('grill') &&
    /\b(grill|griddle) pan\b/i.test(text) &&
    !/\bbarbecue|bbq\b/i.test(text)
  ) {
    return found.filter((e) => e !== 'grill').concat(found.includes('stove') ? [] : ['stove']);
  }
  return found;
}

export const isNoCook = (equipment: readonly Equipment[]) =>
  !equipment.some((e) => HEAT_SOURCES.includes(e));
