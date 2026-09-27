import type { NewLidlProduct } from '../schema';

const NOTE = 'Типичная упаковка — проверь в магазине';

/**
 * Starter Lidl catalog: generic Hungarian product names and common package sizes, no
 * prices. Fully editable in the app; loose produce (bananas, apples, peppers) is left out.
 */
const RAW: [ingredientId: string, title: string, size: number, unit: 'g' | 'ml' | 'pcs'][] = [
  ['tvorog', 'Túró', 250, 'g'],
  ['skyr', 'Skyr natúr', 450, 'g'],
  ['greek_yogurt', 'Görög joghurt', 400, 'g'],
  ['yogurt_01', 'Zsírszegény joghurt 0,1%', 500, 'g'],
  ['egg', 'Tojás M', 10, 'pcs'],
  ['oats', 'Zabpehely', 500, 'g'],
  ['muesli', 'Müzli', 500, 'g'],
  ['berries_frozen', 'Fagyasztott erdei gyümölcs', 500, 'g'],
  ['bread_wholegrain', 'Teljes kiőrlésű kenyér', 500, 'g'],
  ['chicken_breast', 'Csirkemellfilé', 500, 'g'],
  ['turkey_mince', 'Darált pulykahús', 500, 'g'],
  ['rice', 'Rizs', 1000, 'g'],
  ['penne', 'Penne tészta', 500, 'g'],
  ['lentils_green', 'Zöld lencse', 500, 'g'],
  ['potato', 'Burgonya', 2000, 'g'],
  ['veg_frozen', 'Fagyasztott zöldségkeverék', 1000, 'g'],
  ['passata', 'Passata', 500, 'g'],
  ['tomatoes_canned', 'Hámozott paradicsom konzerv', 400, 'g'],
  ['onion', 'Vöröshagyma', 1000, 'g'],
  ['cheese', 'Trappista sajt', 250, 'g'],
  ['tuna_water', 'Tonhal saját lében', 1, 'pcs'],
  ['oil', 'Napraforgó étolaj', 1000, 'ml'],
];

export const SEED_LIDL: NewLidlProduct[] = RAW.map(
  ([ingredientId, title, packageSize, packageUnit]) => ({
    id: `lidl_${ingredientId}`,
    ingredientId,
    title,
    packageSize,
    packageUnit,
    notes: NOTE,
  }),
);
