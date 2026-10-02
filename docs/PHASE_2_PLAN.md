# PHASE 2 — migration plan

Written before task 1, as `PHASE_2.md` asks. Describes the current data model, the target
model and how user data moves across. Numbers that only exist after the pipeline runs
(recipes accepted, products, APK growth) are reported per task.

## 1. Current state (v1.1, migrations 0000–0010)

| Table | Role today | Notes for v2 |
|---|---|---|
| `ingredients` | 31 seeded products + user-created (`is_custom`) | 10 flat categories; Russian `name`, `name_hu`; English lives in `src/i18n/content/en.ts`; user fields `low_stock_threshold`, `last_added_amount` |
| `lidl_products` | ~25 seeded Lidl packages, user-editable price/sale/notes/barcode | becomes `product_variants` |
| `recipes` | 16 own recipes (Z1…U4) | single `meal_type`; user field `photo_uri` |
| `recipe_ingredients`, `recipe_steps` | lines and steps of seeded recipes | re-synced by the seed (delete + insert per recipe) |
| `recipe_custom_amounts` | «моя версия рецепта» | separate table — already survives re-syncs |
| `pantry_items`, `meal_logs`, `cook_sessions`, `prepared_portions`, `shopping_items`, `profile`, `weight_logs`, `app_meta` | user data | never touched by the catalog update |

Seeding today: `runSeed` (TS seed files, `SEED_VERSION` in `app_meta`) inserts ingredients
with `onConflictDoNothing`, upserts recipes, and re-creates lines/steps.

## 2. Target model

**Catalog tables (rewritten by the catalog update):**
- `ingredients` gains: `name_en`, `synonyms` (json), `subcategory`, `fat_per_100g`, `carbs_per_100g`,
  `tags` (json: vegetarian, vegan, pork, alcohol, lactose, gluten), `source` (usda|manual|own),
  `source_id`, `search_text` (normalised ru/hu/en/synonyms, indexed), `is_archived`.
  `category` moves to the 10 PHASE_2 categories; `subcategory` is new.
- `product_variants` (renamed `lidl_products`): catalog columns `title`, `brand`, `package_size`,
  `package_unit`, `barcode`, `kcal_per_100g`, `protein_per_100g`, `image_key`, `source`,
  `source_id`, `is_archived`; **user columns** `price_huf`, `on_sale`, `sale_until`, `notes`
  are never in the upsert's `SET` list, so manual prices and sales survive.
- `recipes` gains: `name_en`, `description_ru/en`, `cuisine`, `meal_types` (json),
  `source` (own|mealdb), `source_id`, `ingredient_count`, precomputed `kcal_per_serving`,
  `protein_per_serving`, `protein_density`, `tags`, `is_archived`. `meal_type` stays as the
  primary meal (filters/indexes), `meal_types` lists all that fit.
- `recipe_steps` gains `text_en`.
- `catalog_meta(key, value)` with `catalogVersion` (replaces `seed_version`).

**User tables:** unchanged, plus `ingredients.is_archived` handling in the UI.

Translations move from `src/i18n/content/en.ts` into catalog columns (`name_en`, `text_en`),
so one mechanism covers own and imported recipes. The content helpers keep their API.

## 3. Catalog update at start-up (task 7)

One transaction, only when the bundled `catalogVersion` is newer:
1. Apply `v1-id-map.json` renames to every reference (`pantry_items`, `meal_logs` via recipes,
   `recipe_custom_amounts`, `shopping_items`, `cook_sessions.amount_overrides` keys).
2. Upsert ingredients, variants, recipes by stable id (catalog columns only).
3. Re-create lines and steps of catalog recipes (as today).
4. Ids that left the catalog: delete if unreferenced, else `is_archived = 1` (hidden from
   pickers, still shown in history and «Дома»).
5. User products (`is_custom`): match to a catalog product by normalised name/synonym; on a
   match move all references, else archive and list them for the one-time
   «Эти продукты больше не поддерживаются» screen.
6. Write `catalogVersion`. Running it again is a no-op.

Old JSON backups (v1/v1.1): imported as today, then the same catalog update runs.

## 4. Pipeline (`tools/data-pipeline/`, separate package)

`fetch` (TheMealDB a–z + categories, USDA FoodData Central bulk CSV, Open Food Facts Lidl HU)
→ raw cache (git-ignored) → `build` (parse ingredients, map to canonical products, grams via
USDA portions/manual table, nutrition via the app's `src/domain/nutrition.ts`, servings and
recomp filter from `pipeline.config.ts`, translation/steps via Claude API with zod schema and
hash cache, overrides) → `validate` → `src/db/seed/catalog.v2.json` + images.

## 5. Risks to watch

- TheMealDB is small (hundreds of recipes) and not protein-focused: expect a modest number
  after the recomp filter; reported honestly after task 3.
- TheMealDB terms: free for personal/educational use — re-check before a public release.
- Open Food Facts coverage of Lidl Hungary is partial; ODbL / CC BY-SA attribution required.
- APK size: images are processed to WebP; growth reported in task 5 (flag if > ~40 MB).
- Task 4 needs `ANTHROPIC_API_KEY` in `.env.local`.
