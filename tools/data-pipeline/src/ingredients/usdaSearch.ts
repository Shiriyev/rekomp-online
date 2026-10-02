/**
 * Name search over USDA descriptions for the mapping draft. A heuristic only: every pick is
 * reviewed by a person before it reaches the catalog (mappings/ingredient-map.json).
 */
import type { UsdaFood } from '../usda/load.ts';

const NOISE =
  /\b(babyfood|baby food|infant|fast food|restaurant|school lunch|formula|imitation|alaska native|frozen meal|snacks?)\b/i;
const PREFERRED = /\b(raw|fresh|dry|dried|whole|plain)\b/i;

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

export type Candidate = { fdcId: number; description: string; dataset: string; score: number };

export function searchUsda(name: string, foods: readonly UsdaFood[], limit = 5): Candidate[] {
  const want = tokens(name);
  if (want.length === 0) return [];
  const head = want[want.length - 1]!;
  const scored: Candidate[] = [];
  for (const f of foods) {
    if (f.kcal === null || f.protein === null) continue;
    const desc = f.description.toLowerCase();
    const have = new Set(tokens(desc));
    // A token counts when it matches a description word or its singular/plural form.
    const matched = want.filter((w) => have.has(w) || have.has(`${w}s`) || have.has(`${w}es`));
    if (matched.length === 0 || !matched.includes(head)) continue;
    let score = matched.length / want.length;
    const first = desc.split(',')[0]!.trim();
    if (first === head || first === `${head}s` || first === `${head}es`) score += 0.6;
    if (PREFERRED.test(desc)) score += 0.2;
    if (NOISE.test(desc)) score -= 1;
    score -= Math.min(0.5, desc.length / 300);
    if (f.dataset === 'foundation') score += 0.1;
    scored.push({ fdcId: f.fdcId, description: f.description, dataset: f.dataset, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
