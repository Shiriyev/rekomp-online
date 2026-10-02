# Ingredient mapping review notes

Files: `mappings/canonical.json`, `mappings/ingredient-map.json`, `mappings/translations.json`.

## Counts

- Canonical products: **418** (31 v1 + 387 new). 67 are staples; 72 have `manualMacros`.
- Draft names: **729**. **724 mapped**, **5 unmapped**.
- Every map value is a canonical id. Every canonical id has a ru/hu translation. Every `usdaFdcId` is in `raw/usda/index.json` with kcal and protein. No duplicate ids. The zod schema in `src/build/mappings.ts` loads all files.

## Unmapped (5)

| name | reason |
|---|---|
| meat | raw "Shredded Meat": meat type is not stated |
| mixed grain | "1 Packet": composition and weight unknown |
| ginger cordial | branded drink concentrate |
| corn arepa filled with mozarella cheese | a prepared dish, not an ingredient |
| chimichurri sauce | homemade sauce, never quantified |

## Manual macros

**v1 (31):** the app's agreed kcal and protein are copied from the seed. `usdaFdcId` is only a reference. Russian and Hungarian names are the seed values.

- Some reference records are loose matches: muesli → granola 171646, skyr → Greek nonfat yogurt, berries_frozen → frozen strawberries, tvorog → full-fat cottage cheese.
- The units and pieces from the seed are kept, including `tuna_water` as pcs/120 g.
- **Added:** `gramsPerPiece` on four v1 products that had none in the seed, so piece counts like "2 tomatoes" convert: chicken_breast 170, tomato 120, cucumber 300, potato 170. The unit stays `g`. **Check this.**

**No sensible USDA record (41), typical values per 100 g:**

| product | kcal / protein | note |
|---|---|---|
| oxtail | 150 / 13 | as bought, with bone |
| cured_ham | 250 / 26 | prosciutto / serrano / parma / jamón |
| dried_shrimp | 265 / 58 | |
| seafood_mix | 80 / 14 | |
| clotted_cream | 586 / 1.6 | |
| creme_fraiche | 292 / 2.4 | |
| manchego | 420 / 26 | |
| mascarpone | 429 / 4.6 | |
| paneer | 265 / 18 | |
| casabe | 330 / 1.5 | cassava flatbread |
| rice_paper | 340 / 3 | |
| sweet_chilli_sauce | 220 / 0.5 | |
| thai_red_curry_paste, thai_green_curry_paste | 150 / 3 | brands vary a lot |
| curry_paste (Indian, oil-based) | 430 / 4 | |
| chilli_bean_paste | 150 / 8 | |
| red_pepper_paste | 75 / 3 | |
| pomegranate_molasses | 280 / 0.5 | |
| mirin | 240 / 0.3 | |
| sugar_syrup | 260 / 0 | |
| mincemeat (sweet) | 280 / 0.6 | |
| flax_egg | 72 / 2.5 | 7 g ground flax + 45 g water; pcs = 52 g |
| pickle_brine | 10 / 0.2 | staple |

**Staples with manual values (0 kcal in the app anyway):** banana_leaf (0/0, a wrapper), wild_garlic, mixed_herbs, lime_leaf, pandan_leaf, garam_masala, five_spice, sumac, sichuan_pepper, ras_el_hanout, harissa_spice, cajun_seasoning, jerk_seasoning, annatto, mahleb, vanilla_pod, almond_extract, rose_water.

## Judgement calls to double-check

1. **beef**: the normalizer merged "Beef" with "Minced Beef" and "lean minced beef". The raw data has about 34 "Beef" (stewing cuts, kg amounts) and 12 minced. I mapped it to stewing beef (chuck for stew, 128 kcal). Minced-beef uses are undercounted by about 60 kcal per 100 g. "ground beef" → `beef_mince`. Consider splitting in the normalizer.
2. **pepper** → black pepper (v1 staple). 111 raw uses, mostly "to taste" or "pinch". Bell peppers come through "red/green/yellow pepper".
3. **corn flour** → `cornstarch`: in British usage this is cornflour, a thickener. Cornmeal and masa are separate products.
4. **tomato puree** → `tomato_puree` (tomato paste). The measures are tbsp, so this is the British purée. Passata is the v1 `passata`.
5. **coriander** (69 uses: chopped, bunch, handful) → fresh leaf. "ground coriander" → `ground_coriander` (seed).
6. **tuna** (3 uses: "1 can", 200–400 g) → v1 `tuna_water` (canned).
7. **Canned legumes:** chickpeas, kidney beans and butter beans use "canned, solids and liquids" records. These match 400 g can weights. Cannellini, pinto and black beans use drained records. Dried beans and split peas are separate dry products.
8. **chicken** (whole or pieces): meat-and-skin record with `gramsPerPiece` 1000 for "1 whole". This counts edible weight of a ~1.4 kg bird. Bone-in weights in grams will be slightly overcounted. Bone-in cuts are counted the same way (chicken_leg 250 g, chicken_wing 60 g, lamb_chop 100 g).
9. **duck_leg** → "Duck, meat and skin, raw" (404 kcal). This is the whole-bird record, so it overstates a leg. A raw leg is about 220–250 kcal.
10. **garlic** is pcs at 3 g per clove (USDA). "garlic bulb" (2 uses, "1") is also mapped here, so it is undercounted (about 40 g per bulb).
11. **Merged spellings:**
    - semi-skimmed milk → milk (whole-milk record)
    - whipping cream → cream (heavy)
    - savoy and hispi cabbage → cabbage
    - all white rice varieties, including sushi, paella and glutinous → rice
    - all dry pasta shapes → pasta (penne stays the v1 product)
    - sherry (dry and sweet) → sherry
    - stout and dark beer → beer
    - rice wine → sake
12. **Mapped to a close product:**
    - stir-fry, roasted and raw vegetables → v1 veg_frozen
    - doner meat → lamb_mince
    - farmers cheese and fromage frais → tvorog
    - bryndza → feta
    - cheese curd → cheddar
    - gouda, monterey jack, mexican and panquehue → v1 cheese
    - stilton → blue_cheese
    - emmental → swiss_cheese
    - peppadew, padron, romano, banana and roasted pepper → bell_pepper
    - habanero → scotch_bonnet
    - galangal and ginger pastes → ginger
    - wood ear → shiitake
    - prahok → fish_sauce
    - salsa lizano → worcestershire_sauce
    - alinos, sazon, kabse and fajita seasonings → seasoning_mix
    - chinese sesame sauce → tahini
    - aioli and garlic sauce → mayonnaise
    - truffle oil → olive_oil
    - potato starch → cornstarch
    - tempura flour → flour
    - white bread mix → bread_flour
    - rice flour pancake → flour tortilla
    - ciabatta and cuban bread → baguette
    - canned beans → kidney_beans
    - seeds → sunflower_seed
    - dried white corn and grits → cornmeal
    - callaloo, mulukhiyah and morning glory → leafy_greens (amaranth record)
13. **Proxy USDA records:**
    - udon → somen dry
    - star anise → anise seed
    - chilli_flakes → cayenne
    - rice_vinegar → distilled vinegar
    - conch → baked record (no raw record)
    - white_fish and cod → Atlantic cod
    - egg_roll → vegetable egg roll
    - mung_bean_paste → cooked mung beans
14. **Tags:**
    - All dairy and eggs are tagged vegetarian, as instructed. Traditional parmesan, pecorino, gruyère and manchego use animal rennet, so strict vegetarians may disagree.
    - `lactose` is left off aged hard cheeses (cheddar, parmesan, pecorino, gruyère, swiss, manchego, blue).
    - Oats are not tagged `gluten`.
    - `vanilla_extract`, `almond_extract` and `mirin` are tagged `alcohol`, along with wines, beer, cider, sake and brandy.
    - worcestershire_sauce, fish_sauce and oyster_sauce carry no vegetarian tags.
    - Thai curry pastes carry no vegetarian tags because they usually contain shrimp paste.
15. **Categories:**
    - Coconut milk, coconut cream, sugar, wine and other alcohol go under `other/other`.
    - Soy and almond milk go under `dairy_eggs/milk_cream`, tagged vegan.
    - Tomato paste, stocks, mirin and curry pastes go under `sauces_oils_spices/sauces`.
    - Lemon and orange zest are staples under spices.
