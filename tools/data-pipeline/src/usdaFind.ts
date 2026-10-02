/**
 * usda:find — reviewer helper: `npm run usda:find -- "egg.*whole.*raw" "chicken.*breast"`
 * prints matching USDA foods (regex on the description) with kcal/protein per 100 g.
 */
import { loadUsda } from './usda/load.ts';

const foods = loadUsda().filter((f) => f.kcal !== null && f.protein !== null);
for (const q of process.argv.slice(2)) {
  const re = new RegExp(q, 'i');
  const hits = foods.filter((f) => re.test(f.description)).slice(0, 8);
  console.log(`# ${q}`);
  for (const f of hits) {
    const pieces = f.portions
      .slice(0, 3)
      .map((p) => `${p.amount} ${p.unit} ${p.modifier}=${p.grams}g`.replace(/\s+/g, ' '))
      .join('; ');
    console.log(`  ${f.fdcId}  ${f.description}  [${f.kcal} kcal, ${f.protein} g P]  ${pieces}`);
  }
}
