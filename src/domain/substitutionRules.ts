import type { Substitute, SubstitutionRules } from './substitutions';

/**
 * A member of a swap group: its id, and optionally how potent it is per gram relative
 * to the rest of the group. A concentrate, a dried spice or a dry pulse is stronger, so
 * less of it replaces more of the others. A plain id is strength 1.
 */
type Member = string | readonly [id: string, strength: number];

type Group = { readonly name: string; readonly members: readonly Member[] };

/**
 * Products that stand in for one another in most dishes. A product may appear in several
 * groups (soured cream thickens like cream and spoons like yogurt); the swaps are merged
 * and the first group to name a pair sets its ratio.
 *
 * These are cooking swaps, not nutrition swaps: macros are recalculated from whichever
 * product is actually chosen, so a swap can change what a dish costs in calories.
 */
const GROUPS: readonly Group[] = [
  // Butter and vegan butter are about 82% fat, so slightly more of them replaces oil.
  {
    name: 'cooking_fat',
    members: [
      'oil',
      'olive_oil',
      'peanut_oil',
      'coconut_oil',
      'sesame_oil',
      'lard',
      'goose_fat',
      'tallow',
      'shortening',
      ['butter', 0.82],
      ['vegan_butter', 0.82],
    ],
  },

  { name: 'mince', members: ['beef_mince', 'turkey_mince', 'pork_mince', 'lamb_mince'] },
  {
    name: 'poultry_pieces',
    members: ['chicken_breast', 'chicken_thigh', 'chicken_leg', 'chicken_drumstick', 'turkey'],
  },
  {
    name: 'red_meat_cuts',
    members: [
      'beef',
      'beef_steak',
      'beef_flank',
      'beef_brisket',
      'pork',
      'pork_shoulder',
      'pork_tenderloin',
      'pork_chop',
      'lamb',
      'lamb_shoulder',
      'lamb_chop',
    ],
  },
  {
    name: 'cured_pork',
    members: ['bacon', 'ham', 'cured_ham', 'chorizo', 'sausage', 'kabanos', 'turkey_ham'],
  },

  { name: 'white_fish', members: ['white_fish', 'cod', 'haddock', 'sea_bass'] },
  { name: 'oily_fish', members: ['salmon', 'trout', 'mackerel', 'herring', 'sardine'] },
  { name: 'seafood', members: ['prawn', 'seafood_mix', 'squid', 'mussel', 'crab', 'clam'] },

  {
    name: 'thick_dairy',
    members: [
      'greek_yogurt',
      'skyr',
      'tvorog',
      'cottage_cheese',
      'yogurt',
      'yogurt_01',
      'sour_cream',
      'creme_fraiche',
    ],
  },
  {
    name: 'cream',
    members: ['cream', 'single_cream', 'clotted_cream', 'creme_fraiche', 'coconut_cream'],
  },
  { name: 'milk', members: ['milk', 'soya_milk', 'almond_milk', 'buttermilk', 'evaporated_milk'] },
  {
    name: 'hard_cheese',
    members: ['cheese', 'cheddar', 'parmesan', 'pecorino', 'gruyere', 'swiss_cheese', 'manchego'],
  },
  {
    name: 'soft_cheese',
    members: ['feta', 'goat_cheese', 'mozzarella', 'ricotta', 'queso_fresco', 'paneer'],
  },
  { name: 'spreadable_cheese', members: ['cream_cheese', 'mascarpone', 'ricotta'] },

  {
    name: 'grain_side',
    members: ['rice', 'brown_rice', 'bulgur', 'couscous', 'quinoa', 'buckwheat'],
  },
  { name: 'pasta', members: ['pasta', 'penne', 'egg_noodles', 'rice_noodles', 'udon_noodles'] },
  // Dry pulses roughly double in weight once cooked, so far less of them is needed.
  {
    name: 'pulses',
    members: [
      'chickpeas',
      'kidney_beans',
      'cannellini_beans',
      'black_beans',
      'butter_beans',
      'pinto_beans',
      ['white_beans_dry', 2.2],
      ['lentils_green', 2.2],
      ['split_peas', 2.2],
    ],
  },
  { name: 'flour', members: ['flour', 'bread_flour', 'wholemeal_flour', 'self_raising_flour'] },
  { name: 'plant_protein', members: ['tofu', 'silken_tofu', 'tempeh', 'paneer'] },

  // Tomato purée is a concentrate.
  {
    name: 'tomato_base',
    members: ['passata', 'tomatoes_canned', 'tomato_sauce', ['tomato_puree', 3]],
  },
  { name: 'stock', members: ['chicken_stock', 'vegetable_stock', 'beef_stock', 'fish_stock'] },

  { name: 'onion', members: ['onion', 'red_onion', 'shallot', 'leek', 'spring_onion'] },
  {
    name: 'greens',
    members: ['spinach', 'kale', 'leafy_greens', 'rocket', 'chinese_cabbage', 'pak_choi'],
  },
  { name: 'cabbage', members: ['cabbage', 'red_cabbage', 'chinese_cabbage'] },
  { name: 'squash', members: ['courgette', 'butternut_squash', 'pumpkin'] },
  {
    name: 'root_veg',
    members: ['potato', 'sweet_potato', 'turnip', 'swede', 'parsnip', 'celeriac'],
  },
  { name: 'mushroom', members: ['mushroom', 'shiitake', 'oyster_mushroom'] },
  { name: 'tomato_fresh', members: ['tomato', 'cherry_tomato'] },
  { name: 'peas_beans', members: ['peas', 'green_beans', 'snap_peas', 'broad_beans'] },

  {
    name: 'berries',
    members: ['berries_frozen', 'strawberry', 'raspberry', 'blackberry', 'cherry', 'cranberry'],
  },
  { name: 'citrus_juice', members: ['lemon_juice', 'lime_juice'] },
  { name: 'citrus', members: ['lemon', 'lime'] },
  { name: 'dried_fruit', members: ['raisins', 'dried_apricot', 'prune', 'cranberry'] },

  {
    name: 'bread',
    members: ['bread_white', 'bread_wholegrain', 'rye_bread', 'baguette', 'english_muffin'],
  },
  { name: 'wrap', members: ['tortilla', 'corn_tortilla', 'pita', 'naan'] },

  {
    name: 'nuts',
    members: ['almond', 'walnut', 'cashew', 'hazelnut', 'peanut', 'pistachio', 'pine_nut'],
  },

  {
    name: 'vinegar',
    members: ['vinegar', 'wine_vinegar', 'cider_vinegar', 'rice_vinegar', 'balsamic_vinegar'],
  },
  {
    name: 'umami_sauce',
    members: ['soy_sauce', 'fish_sauce', 'oyster_sauce', 'hoisin_sauce', 'worcestershire_sauce'],
  },
  // Honey and syrups are sweeter than sugar by weight.
  {
    name: 'sweetener',
    members: [
      'sugar',
      'brown_sugar',
      'icing_sugar',
      ['honey', 0.75],
      ['maple_syrup', 0.75],
      ['molasses', 0.8],
    ],
  },

  // Dried and ground forms are far stronger per gram than the fresh product.
  {
    name: 'fresh_chilli',
    members: ['red_chilli', 'green_chilli', 'jalapeno', ['scotch_bonnet', 5]],
  },
  {
    name: 'ground_chilli',
    members: ['chilli_powder', 'chilli_flakes', ['cayenne', 1.5], ['paprika_powder', 0.4]],
  },
  { name: 'garlic', members: ['garlic', ['garlic_powder', 3]] },
  { name: 'ginger', members: ['ginger', ['ground_ginger', 3]] },
  { name: 'soft_herbs', members: ['parsley', 'coriander_leaf', 'basil', 'dill', 'chives'] },
  {
    name: 'woody_herbs',
    members: [
      'thyme',
      'rosemary',
      'oregano',
      'marjoram',
      'sage',
      'tarragon',
      'summer_savory',
      'mixed_herbs',
    ],
  },
  {
    name: 'curry_paste',
    members: ['thai_red_curry_paste', 'thai_green_curry_paste', 'curry_paste'],
  },
  { name: 'curry_powder', members: ['curry_powder', 'garam_masala', 'ras_el_hanout'] },
  { name: 'hot_sauce', members: ['hot_sauce', 'sriracha', 'chilli_sauce'] },
  { name: 'mustard', members: ['mustard', ['mustard_powder', 3]] },

  { name: 'egg', members: ['egg', 'flax_egg'] },
  { name: 'cooking_wine', members: ['white_wine', 'red_wine', 'sherry', 'sake', 'mirin'] },
  { name: 'olives', members: ['green_olives', 'black_olives'] },
  { name: 'pickles', members: ['dill_pickle', 'sauerkraut'] },
  { name: 'thickener', members: ['cornstarch', ['flour', 0.5]] },
];

const memberOf = (m: Member): { id: string; strength: number } =>
  typeof m === 'string' ? { id: m, strength: 1 } : { id: m[0], strength: m[1] };

/** Expands the swap groups into the per-product lookup the engine takes. */
export function buildRules(groups: readonly Group[] = GROUPS): SubstitutionRules {
  const out = new Map<string, Substitute[]>();
  for (const group of groups) {
    const members = group.members.map(memberOf);
    for (const from of members) {
      let list = out.get(from.id);
      if (!list) {
        list = [];
        out.set(from.id, list);
      }
      for (const to of members) {
        if (to.id === from.id || list.some((s) => s.id === to.id)) continue;
        list.push({ id: to.id, ratio: from.strength / to.strength });
      }
    }
  }
  return out;
}

export const SUBSTITUTION_RULES: SubstitutionRules = buildRules();
