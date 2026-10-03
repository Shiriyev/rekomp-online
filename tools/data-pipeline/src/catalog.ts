/**
 * catalog — PHASE_2 task 6: assembles src/db/seed/catalog.v2.json from the reviewed
 * mappings, the build output (cache/evaluated.json), the translations, the own recipes and
 * the v1 seed (kept with source «own» and unchanged ids), plus src/features/catalogImages.ts
 * with a static require() per bundled photo. Numbers come only from USDA / reviewed values
 * through the app's nutrition code. Run `npm run build` first.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { CATALOG_VERSION } from '../pipeline.config.ts';
import { productMacros, type Accepted, type MealType, type RecipeTag } from './build/evaluate.ts';
import { loadMappings, type Canonical } from './build/mappings.ts';
import {
  proteinCriteria,
  RECIPE_CRITERIA,
  type MainProtein,
  RECIPES_EN,
  SEED_RECIPES,
  type Catalog,
  type CatalogIngredient,
  type CatalogLine,
  type CatalogRecipe,
  type CatalogStep,
} from './lib/app.ts';
import {
  ingredientMacros,
  recipeMacros,
  type NutritionIngredient,
  type Unit,
} from './lib/domain.ts';
import { detectEquipment } from './build/equipment.ts';
import { APP_ROOT, ROOT } from './lib/paths.ts';
import { loadOwnRecipes } from './own/recipes.ts';
import { loadOverrides, loadTranslation } from './translate/load.ts';
import { loadUsda } from './usda/load.ts';

export const CATALOG_FILE = path.join(APP_ROOT, 'src', 'db', 'seed', 'catalog.v2.json');
const IMAGES_MODULE = path.join(APP_ROOT, 'src', 'features', 'catalogImages.ts');
/** The app reads this at start-up and loads the (large) catalog only when it is newer. */
const VERSION_MODULE = path.join(APP_ROOT, 'src', 'db', 'seed', 'catalogVersion.ts');
const IMAGES = path.join(APP_ROOT, 'assets', 'images');

/** imageKey → file under assets/images (v1 photos are .jpg, catalog photos .webp). */
export function imageFile(key: string): string | undefined {
  for (const ext of ['webp', 'jpg']) {
    const file = path.join(IMAGES, `${key}.${ext}`);
    if (existsSync(file)) return file;
  }
  return undefined;
}

/** Same lunch defaults as the v1 seed (runSeed): lunches are cooked for 3 days. */
const V1_LUNCH = { defaultServings: 3, isBatch: true } as const;
const V1_SINGLE = { defaultServings: 1, isBatch: false } as const;

const SEAFOOD = new Set([
  'prawn',
  'dried_shrimp',
  'seafood_mix',
  'squid',
  'mussel',
  'clam',
  'oyster',
  'conch',
  'lobster',
  'crab',
]);

/** Shelf of a protein source by its catalog category. */
function proteinShelf(p: Canonical): MainProtein {
  switch (p.category) {
    case 'meat_poultry':
      if (p.subcategory === 'chicken' || p.subcategory === 'turkey' || p.id.startsWith('turkey'))
        return 'poultry';
      if (
        p.subcategory === 'beef' ||
        p.id.startsWith('beef') ||
        p.id === 'corned_beef' ||
        p.id === 'oxtail'
      )
        return 'beef';
      if (p.subcategory === 'pork' || p.id.startsWith('pork') || p.tags.includes('pork'))
        return 'pork';
      if (p.id.startsWith('chicken') || p.id.startsWith('duck')) return 'poultry';
      return 'lamb';
    case 'fish_seafood':
      return SEAFOOD.has(p.id) ? 'seafood' : 'fish';
    case 'dairy_eggs':
      return p.subcategory === 'eggs' ? 'eggs' : 'dairy';
    case 'grains_pasta_legumes':
      return p.subcategory === 'legumes' ? 'legumes' : 'other';
    default:
      return 'other';
  }
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

/** grams of a product → amount in its own unit (ml ≈ g, as in the app). */
function fromGrams(grams: number, p: Canonical, exact = false): number {
  // «0,38 pcs» of an onion reads badly: pieces go to the nearest quarter (at least ¼),
  // unless that pushes the recipe out of its meal criteria (`exact`).
  if (p.unit === 'pcs') {
    const pieces = grams / p.gramsPerPiece!;
    return exact ? round(pieces, 2) : Math.max(0.25, Math.round(pieces * 4) / 4);
  }
  return round(grams, 1);
}

/** Whether per-serving values meet the criteria of every listed meal (as the validator checks). */
function meetsCriteria(meals: readonly MealType[], kcal: number, protein: number): boolean {
  const share = kcal > 0 ? (protein * 4) / kcal : 0;
  return meals.every((m) => {
    const [lo, hi] = RECIPE_CRITERIA.kcalRange[m];
    const p = proteinCriteria(m);
    return (
      Math.round(kcal) >= lo &&
      Math.round(kcal) <= hi &&
      share >= p.minShare &&
      protein >= p.minGrams
    );
  });
}

const RU_MEASURE: [RegExp, string][] = [
  [/\b(teaspoons?|tsp)\b\.?/gi, 'ч. л.'],
  [/\b(tablespoons?|tbsp|tbs|tblsp)\b\.?/gi, 'ст. л.'],
  [/\bpinch(es)?\b/gi, 'щепотка'],
  [/\bdash(es)?\b/gi, 'немного'],
  [/\bto taste\b/gi, 'по вкусу'],
  [/\bhandfuls?\b/gi, 'горсть'],
  [/\bbunch(es)?\b/gi, 'пучок'],
  [/\bsprigs?\b/gi, 'веточка'],
  [/\bcloves?\b/gi, 'зубч.'],
  [/\bleaves\b/gi, 'листья'],
  [/\bcups?\b/gi, 'стак.'],
];

/** A staple's source measure («1 tsp», «Pinch») in Russian, else «по вкусу». */
function ruMeasure(raw: string): string {
  let t = raw.trim().replace(/½/g, '1/2').replace(/¼/g, '1/4').replace(/¾/g, '3/4');
  for (const [re, ru] of RU_MEASURE) t = t.replace(re, ru);
  return /[a-z]/i.test(t) || t === '' ? 'по вкусу' : t;
}

function main() {
  const { canonical, translations } = loadMappings();
  const usda = new Map(loadUsda().map((f) => [f.fdcId, f]));
  const products = new Map(canonical.map((p) => [p.id, p]));

  // ---------- ingredients ----------
  const ingredients: CatalogIngredient[] = canonical.map((p) => {
    const m = productMacros(p, usda);
    const v1Photo = imageFile(`ingredients/${p.id}`) ? `ingredients/${p.id}` : null;
    const catalogPhoto = imageFile(`catalog/products/${p.id}`) ? `catalog/products/${p.id}` : null;
    return {
      id: p.id,
      name: translations[p.id]!.ru,
      nameEn: p.nameEn,
      nameHu: translations[p.id]!.hu || null,
      synonyms: p.synonyms,
      category: p.category,
      subcategory: p.subcategory,
      unit: p.unit,
      gramsPerPiece: p.gramsPerPiece,
      kcalPer100g: round(m.kcal, 1),
      proteinPer100g: round(m.protein, 1),
      fatPer100g: m.fat === null ? null : round(m.fat, 1),
      // USDA carbs are «by difference» and can come out slightly negative for meat.
      carbsPer100g: m.carbs === null ? null : round(Math.max(0, m.carbs), 1),
      isStaple: p.isStaple,
      stockTracked: p.stockTracked,
      tags: p.tags,
      source: p.manualMacros ? 'manual' : 'usda',
      sourceId: p.manualMacros || p.usdaFdcId === null ? null : String(p.usdaFdcId),
      imageKey: v1Photo ?? catalogPhoto,
    };
  });
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const nutrition = new Map<string, NutritionIngredient>(
    ingredients.map((i) => [
      i.id,
      {
        id: i.id,
        unit: i.unit,
        gramsPerPiece: i.gramsPerPiece,
        kcalPer100g: i.kcalPer100g,
        proteinPer100g: i.proteinPer100g,
        isStaple: i.isStaple,
      },
    ]),
  );

  const recipes: CatalogRecipe[] = [];
  const recipeIngredients: CatalogLine[] = [];
  const recipeSteps: CatalogStep[] = [];

  const tagsOf = (ids: readonly string[]): RecipeTag[] => {
    const ps = ids.map((id) => products.get(id)!);
    const tags = new Set<RecipeTag>();
    for (const t of ['pork', 'alcohol', 'lactose', 'gluten'] as const)
      if (ps.some((p) => p.tags.includes(t))) tags.add(t);
    if (ps.every((p) => p.tags.includes('vegetarian'))) tags.add('vegetarian');
    if (ps.every((p) => p.tags.includes('vegan'))) tags.add('vegan');
    return [...tags];
  };

  /** The product giving most of the protein decides the shelf («Курица», «Рыба», …). */
  const mainProteinOf = (lines: readonly CatalogLine[]): MainProtein => {
    let best: { id: string; protein: number } | null = null;
    for (const l of lines) {
      if (l.optional) continue;
      const n = nutrition.get(l.ingredientId)!;
      const { protein } = ingredientMacros(n, l.amountPerServing, l.unit);
      if (!best || protein > best.protein) best = { id: l.ingredientId, protein };
    }
    return best ? proteinShelf(products.get(best.id)!) : 'other';
  };

  const push = (
    r: Omit<
      CatalogRecipe,
      | 'kcalPerServing'
      | 'proteinPerServing'
      | 'proteinDensity'
      | 'ingredientCount'
      | 'tags'
      | 'equipment'
      | 'mainProtein'
    >,
    lines: Omit<CatalogLine, 'recipeId' | 'sortOrder'>[],
    steps: Omit<CatalogStep, 'recipeId' | 'order'>[],
  ) => {
    const catalogLines = lines.map((l, sortOrder) => ({ recipeId: r.id, sortOrder, ...l }));
    const { perServing } = recipeMacros(catalogLines, nutrition);
    recipes.push({
      ...r,
      tags: tagsOf(lines.map((l) => l.ingredientId)),
      equipment: detectEquipment(steps.map((s) => s.textEn)),
      mainProtein: mainProteinOf(catalogLines),
      ingredientCount: lines.length,
      kcalPerServing: round(perServing.kcal, 1),
      proteinPerServing: round(perServing.protein, 1),
      proteinDensity: round((perServing.protein / perServing.kcal) * 100, 2),
    });
    recipeIngredients.push(...catalogLines);
    recipeSteps.push(...steps.map((s, i) => ({ recipeId: r.id, order: i + 1, ...s })));
  };

  // ---------- v1 own recipes (ids, amounts and texts unchanged) ----------
  SEED_RECIPES.forEach((r, i) => {
    const en = RECIPES_EN[r.id];
    if (!en) throw new Error(`v1 recipe ${r.id} has no English text`);
    push(
      {
        id: r.id,
        name: r.name,
        nameEn: en.name,
        descriptionRu: null,
        descriptionEn: null,
        cuisine: null,
        mealType: r.mealType,
        mealTypes: [r.mealType],
        ...(r.mealType === 'lunch' ? V1_LUNCH : V1_SINGLE),
        prepNightBefore: r.prepNightBefore ?? false,
        totalMinutes: r.totalMinutes,
        imageKey: imageFile(`recipes/${r.id.toLowerCase()}`)
          ? `recipes/${r.id.toLowerCase()}`
          : null,
        source: 'own',
        sourceId: null,
        sortOrder: i,
      },
      r.lines.map((l) => ({
        ingredientId: l.id,
        amountPerServing: l.amount,
        unit: (l.unit ?? byId.get(l.id)?.unit) as Unit,
        optional: l.optional ?? false,
        altGroup: l.alt ?? null,
        note: l.note ?? null,
        noteEn: l.note ? (en.notes?.[l.id] ?? (l.note === 'по вкусу' ? 'to taste' : null)) : null,
      })),
      r.steps.map((s, n) => ({
        text: s.text,
        textEn: en.steps[n] ?? s.text,
        timerSec: s.timerMin === undefined ? null : Math.round(s.timerMin * 60),
        ingredientRefs: s.refs ?? [],
      })),
    );
  });

  // ---------- new own recipes (breakfasts and snacks) ----------
  for (const r of loadOwnRecipes()) {
    push(
      {
        id: r.id,
        name: r.nameRu,
        nameEn: r.nameEn,
        descriptionRu: r.descriptionRu,
        descriptionEn: r.descriptionEn,
        cuisine: null,
        mealType: r.mealType,
        mealTypes: r.mealTypes,
        defaultServings: r.servings,
        isBatch: r.isBatch,
        prepNightBefore: r.prepNightBefore,
        totalMinutes: r.totalMinutes,
        imageKey: imageFile(`catalog/recipes/${r.id}`) ? `catalog/recipes/${r.id}` : null,
        source: 'own',
        sourceId: null,
        sortOrder: 0,
      },
      r.lines.map((l) => {
        const p = products.get(l.id)!;
        return {
          ingredientId: l.id,
          amountPerServing: fromGrams(l.grams / r.servings, p),
          unit: p.unit,
          optional: false,
          altGroup: null,
          note: l.grams === 0 ? 'по вкусу' : null,
          noteEn: l.grams === 0 ? 'to taste' : null,
        };
      }),
      r.steps.map((s) => ({
        text: s.ru,
        textEn: s.en,
        timerSec: s.timerSec,
        ingredientRefs: s.ingredientRefs,
      })),
    );
  }

  // ---------- TheMealDB ----------
  const linesFor = (a: Accepted, exact: boolean) =>
    a.lines.map((l) => {
      const p = products.get(l.ingredientId)!;
      return {
        ingredientId: l.ingredientId,
        amountPerServing: l.staple ? 0 : fromGrams(l.grams / a.servings, p, exact),
        unit: p.unit,
        // «Oil for frying», «lime to serve»: no amount, outside the nutrition, optional.
        optional: l.staple && !p.isStaple,
        altGroup: null,
        note: l.staple ? ruMeasure(l.rawMeasure) : null,
        noteEn: l.staple ? l.rawMeasure.trim() || 'to taste' : null,
      };
    });
  /** Quarter pieces when the recipe still meets its criteria with them, else exact amounts. */
  const mealdbLines = (a: Accepted) => {
    const rounded = linesFor(a, false);
    const { perServing } = recipeMacros(
      rounded.map((l, sortOrder) => ({ ...l, sortOrder })),
      nutrition,
    );
    return meetsCriteria(a.mealTypes, perServing.kcal, perServing.protein)
      ? rounded
      : linesFor(a, true);
  };

  const accepted = JSON.parse(
    readFileSync(path.join(ROOT, 'cache', 'evaluated.json'), 'utf8'),
  ) as Accepted[];
  const overrides = loadOverrides();
  for (const a of accepted) {
    const loaded = loadTranslation(a.id, overrides);
    if (!loaded) throw new Error(`${a.id} has no translation: run translate:check`);
    const t = loaded.translation;
    const timers = t.steps.reduce((s, x) => s + (x.timerSec ?? 0), 0);
    push(
      {
        id: a.id,
        name: t.nameRu,
        nameEn: a.nameEn,
        descriptionRu: t.descriptionRu,
        descriptionEn: t.descriptionEn,
        cuisine: a.area || null,
        mealType: a.mealType,
        mealTypes: a.mealTypes,
        defaultServings: a.servings,
        isBatch: t.isBatch,
        prepNightBefore: t.prepNightBefore,
        // The stated durations; without any, the step timers plus a little per step.
        totalMinutes: Math.max(
          5,
          a.estimatedMinutes ?? Math.round(timers / 60 + 2 * t.steps.length),
        ),
        imageKey: imageFile(`catalog/recipes/${a.id}`) ? `catalog/recipes/${a.id}` : null,
        source: 'mealdb',
        sourceId: a.sourceId,
        sortOrder: 0,
      },
      mealdbLines(a),
      t.steps.map((s) => ({
        text: s.ru,
        textEn: s.en,
        timerSec: s.timerSec,
        ingredientRefs: s.ingredientRefs,
      })),
    );
  }

  // v1 first (as before), then everything else by meal and protein density.
  const meals = ['breakfast', 'lunch', 'dinner', 'snack'];
  const v1Count = SEED_RECIPES.length;
  const rest = recipes
    .slice(v1Count)
    .sort(
      (a, b) =>
        meals.indexOf(a.mealType) - meals.indexOf(b.mealType) ||
        b.proteinDensity - a.proteinDensity ||
        a.id.localeCompare(b.id),
    );
  rest.forEach((r, i) => (r.sortOrder = v1Count + i));
  const ordered = [...recipes.slice(0, v1Count), ...rest];

  const catalog: Catalog = {
    catalogVersion: CATALOG_VERSION,
    ingredients,
    recipes: ordered,
    recipeIngredients,
    recipeSteps,
  };
  writeFileSync(CATALOG_FILE, JSON.stringify(catalog) + '\n');
  writeFileSync(
    VERSION_MODULE,
    [
      '// Generated by tools/data-pipeline (npm run catalog) — do not edit by hand.',
      '/** catalogVersion of src/db/seed/catalog.v2.json. */',
      `export const BUNDLED_CATALOG_VERSION = ${CATALOG_VERSION};`,
      '',
    ].join('\n'),
  );

  // ---------- static requires for the bundled photos ----------
  const keys = [
    ...new Set([...ingredients, ...ordered].flatMap((x) => (x.imageKey ? [x.imageKey] : []))),
  ].sort();
  writeFileSync(
    IMAGES_MODULE,
    [
      '// Generated by tools/data-pipeline (npm run catalog) — do not edit by hand.',
      '/** Bundled catalog photos by imageKey (path under assets/images without extension). */',
      'export const CATALOG_IMAGES: Readonly<Record<string, number>> = {',
      ...keys.map((k) => {
        const rel = path.relative(path.dirname(IMAGES_MODULE), imageFile(k)!);
        return `  '${k}': require('${rel}'),`;
      }),
      '};',
      '',
    ].join('\n'),
  );

  const count = (m: string) => ordered.filter((r) => r.mealTypes.includes(m as never)).length;
  console.log(
    `catalog v${CATALOG_VERSION}: ${ingredients.length} products, ` +
      `${ordered.length} recipes (${ordered.filter((r) => r.source === 'own').length} own, ` +
      `${ordered.filter((r) => r.source === 'mealdb').length} TheMealDB; ` +
      `breakfast ${count('breakfast')}, lunch ${count('lunch')}, dinner ${count('dinner')}, snack ${count('snack')}), ` +
      `${recipeIngredients.length} lines, ${recipeSteps.length} steps, ${keys.length} photos`,
  );
}

if (import.meta.main) main();
