import type { NewIngredient } from '../schema';

/**
 * Approximate nutrition per 100 g (PLAN §6.1). Values are editable in the app and
 * marked "check the label" in the UI. For `pcs` ingredients, nutrition is still per 100 g
 * and `gramsPerPiece` converts pieces to grams.
 */
// prettier-ignore
const RAW_INGREDIENTS = [
  { id: 'tvorog', name: 'Творог', nameHu: 'túró', category: 'dairy_eggs', unit: 'g', kcalPer100g: 130, proteinPer100g: 17 },
  { id: 'skyr', name: 'Скир', nameHu: 'skyr', category: 'dairy_eggs', unit: 'g', kcalPer100g: 63, proteinPer100g: 11 },
  { id: 'greek_yogurt', name: 'Греческий йогурт', nameHu: 'görög joghurt', category: 'dairy_eggs', unit: 'g', kcalPer100g: 70, proteinPer100g: 9 },
  { id: 'yogurt_01', name: 'Йогурт 0,1%', nameHu: 'zsírszegény joghurt', category: 'dairy_eggs', unit: 'g', kcalPer100g: 40, proteinPer100g: 4.5 },
  { id: 'egg', name: 'Яйцо', nameHu: 'tojás', category: 'dairy_eggs', unit: 'pcs', gramsPerPiece: 55, kcalPer100g: 143, proteinPer100g: 12.6 },
  { id: 'oats', name: 'Овсянка', nameHu: 'zabpehely', category: 'grains_pasta_legumes', unit: 'g', kcalPer100g: 370, proteinPer100g: 13 },
  { id: 'muesli', name: 'Мюсли', nameHu: 'müzli', category: 'grains_pasta_legumes', unit: 'g', kcalPer100g: 370, proteinPer100g: 9 },
  { id: 'berries_frozen', name: 'Замороженные ягоды', nameHu: 'fagyasztott bogyós gyümölcs', category: 'fruits_berries', unit: 'g', kcalPer100g: 40, proteinPer100g: 1 },
  { id: 'banana', name: 'Банан', nameHu: 'banán', category: 'fruits_berries', unit: 'pcs', gramsPerPiece: 120, kcalPer100g: 89, proteinPer100g: 1.1 },
  { id: 'apple', name: 'Яблоко', nameHu: 'alma', category: 'fruits_berries', unit: 'pcs', gramsPerPiece: 180, kcalPer100g: 52, proteinPer100g: 0.3 },
  { id: 'bread_wholegrain', name: 'Цельнозерновой хлеб', nameHu: 'teljes kiőrlésű kenyér', category: 'bread_bakery', unit: 'pcs', gramsPerPiece: 35, kcalPer100g: 240, proteinPer100g: 9 },
  { id: 'cucumber', name: 'Огурец', nameHu: 'uborka', category: 'vegetables', unit: 'g', kcalPer100g: 15, proteinPer100g: 0.7 },
  { id: 'tomato', name: 'Помидор', nameHu: 'paradicsom', category: 'vegetables', unit: 'g', kcalPer100g: 18, proteinPer100g: 0.9 },
  { id: 'chicken_breast', name: 'Куриная грудка (сырая)', nameHu: 'csirkemell', category: 'meat_poultry', unit: 'g', kcalPer100g: 110, proteinPer100g: 23 },
  { id: 'turkey_mince', name: 'Фарш индейки', nameHu: 'darált pulyka', category: 'meat_poultry', unit: 'g', kcalPer100g: 140, proteinPer100g: 19 },
  { id: 'rice', name: 'Рис (сухой)', nameHu: 'rizs', category: 'grains_pasta_legumes', unit: 'g', kcalPer100g: 355, proteinPer100g: 7 },
  { id: 'penne', name: 'Пенне (сухие)', nameHu: 'penne tészta', category: 'grains_pasta_legumes', unit: 'g', kcalPer100g: 355, proteinPer100g: 12 },
  { id: 'lentils_green', name: 'Зелёная чечевица (сухая)', nameHu: 'zöld lencse', category: 'grains_pasta_legumes', unit: 'g', kcalPer100g: 350, proteinPer100g: 24 },
  { id: 'potato', name: 'Картофель', nameHu: 'burgonya', category: 'vegetables', unit: 'g', kcalPer100g: 77, proteinPer100g: 2 },
  { id: 'veg_frozen', name: 'Замороженные овощи', nameHu: 'fagyasztott zöldségkeverék', category: 'vegetables', unit: 'g', kcalPer100g: 45, proteinPer100g: 2.5 },
  { id: 'passata', name: 'Пассата', nameHu: 'paradicsompüré (passata)', category: 'other', unit: 'g', kcalPer100g: 35, proteinPer100g: 1.5 },
  { id: 'tomatoes_canned', name: 'Томаты консерв.', nameHu: 'hámozott paradicsom konzerv', category: 'other', unit: 'g', kcalPer100g: 25, proteinPer100g: 1.2 },
  { id: 'onion', name: 'Лук', nameHu: 'vöröshagyma', category: 'vegetables', unit: 'pcs', gramsPerPiece: 100, kcalPer100g: 40, proteinPer100g: 1.1 },
  { id: 'bell_pepper', name: 'Паприка', nameHu: 'kaliforniai paprika', category: 'vegetables', unit: 'pcs', gramsPerPiece: 150, kcalPer100g: 30, proteinPer100g: 1 },
  { id: 'cheese', name: 'Сыр', nameHu: 'sajt (trappista)', category: 'dairy_eggs', unit: 'g', kcalPer100g: 350, proteinPer100g: 25 },
  { id: 'tuna_water', name: 'Тунец в с/с (слитый)', nameHu: 'tonhal saját lében', category: 'other', unit: 'pcs', gramsPerPiece: 120, kcalPer100g: 110, proteinPer100g: 25 },
  { id: 'oil', name: 'Масло растительное', nameHu: 'étolaj', category: 'sauces_oils_spices', unit: 'g', kcalPer100g: 884, proteinPer100g: 0 },
  { id: 'cumin', name: 'Зира', nameHu: 'kömény', category: 'sauces_oils_spices', unit: 'g', kcalPer100g: 0, proteinPer100g: 0, isStaple: true },
  { id: 'salt', name: 'Соль', nameHu: 'só', category: 'sauces_oils_spices', unit: 'g', kcalPer100g: 0, proteinPer100g: 0, isStaple: true },
  { id: 'pepper', name: 'Перец чёрный', nameHu: 'feketebors', category: 'sauces_oils_spices', unit: 'g', kcalPer100g: 0, proteinPer100g: 0, isStaple: true },
  { id: 'paprika_powder', name: 'Паприка молотая', nameHu: 'őrölt paprika', category: 'sauces_oils_spices', unit: 'g', kcalPer100g: 0, proteinPer100g: 0, isStaple: true },
] satisfies NewIngredient[];

export const SEED_INGREDIENTS: NewIngredient[] = RAW_INGREDIENTS.map((i) => ({
  ...i,
  imageKey: i.id,
}));
