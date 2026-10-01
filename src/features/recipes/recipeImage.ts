import { RECIPE_IMAGES } from '@/features/images';

type WithImage = { imageKey: string | null; photoUri: string | null };

/** The dish picture: the user's own photo first, then the bundled one, else none. */
export function recipeImage(recipe: WithImage | undefined): number | { uri: string } | undefined {
  if (!recipe) return undefined;
  if (recipe.photoUri) return { uri: recipe.photoUri };
  return recipe.imageKey ? RECIPE_IMAGES[recipe.imageKey] : undefined;
}
