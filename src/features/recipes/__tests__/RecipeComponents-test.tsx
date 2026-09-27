import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PaperProvider } from 'react-native-paper';

import type { Ingredient, LidlProduct, Recipe, RecipeIngredient } from '@/db/schema';
import { canCook } from '@/domain/pantry';
import { lightTheme } from '@/theme';

import { IngredientRow } from '../IngredientRow';
import { RecipeListItem } from '../RecipeListItem';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const ingredient = (id: string, name: string, over: Partial<Ingredient> = {}): Ingredient => ({
  id,
  name,
  nameHu: null,
  category: 'dairy',
  unit: 'g',
  gramsPerPiece: null,
  kcalPer100g: 63,
  proteinPer100g: 11,
  isStaple: false,
  imageKey: null,
  isCustom: false,
  lowStockThreshold: null,
  ...over,
});

const line = (
  ingredientId: string,
  amount: number,
  over: Partial<RecipeIngredient> = {},
): RecipeIngredient => ({
  recipeId: 'P1',
  ingredientId,
  amountPerServing: amount,
  unit: 'g',
  optional: false,
  altGroup: null,
  sortOrder: 0,
  note: null,
  ...over,
});

const SKYR = ingredient('skyr', 'Скир');
const GREEK = ingredient('greek', 'Греческий йогурт');
const INGREDIENTS = new Map([SKYR, GREEK].map((i) => [i.id, i]));
const LINES = [
  line('skyr', 150, { altGroup: 'y' }),
  line('greek', 150, { altGroup: 'y', sortOrder: 1 }),
];

const wrap = (ui: React.ReactElement) =>
  render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);

const checkWith = (stock: Record<string, number>) =>
  canCook(
    LINES,
    INGREDIENTS,
    new Map(Object.entries(stock).map(([id, q]) => [id, { quantity: q, unit: 'g' as const }])),
    1,
  );

describe('IngredientRow', () => {
  it.each([
    [{ skyr: 200 }, 'Скир, 150 г, есть'],
    [{ skyr: 100 }, 'Скир, 150 г, мало: 100 г'],
    [{}, 'Скир, 150 г, нет'],
  ])('shows availability for stock %j', async (stock, label) => {
    await wrap(
      <IngredientRow
        check={checkWith(stock).lines[0]!}
        ingredient={SKYR}
        alternatives={[GREEK]}
        sale={undefined}
        servings={1}
        onChooseAlternative={jest.fn()}
      />,
    );
    expect(screen.getByLabelText(label)).toBeOnTheScreen();
  });

  it('lets the user pick an alternative and shows an active Lidl sale', async () => {
    const user = userEvent.setup();
    const onChoose = jest.fn();
    const sale = { saleUntil: '2026-10-02' } as LidlProduct;
    await wrap(
      <IngredientRow
        check={checkWith({ skyr: 200 }).lines[0]!}
        ingredient={SKYR}
        alternatives={[GREEK]}
        sale={sale}
        servings={1}
        onChooseAlternative={onChoose}
      />,
    );
    expect(screen.getByText('Скидка в Lidl до 02.10')).toBeOnTheScreen();
    await user.press(screen.getByText('или Греческий йогурт'));
    expect(onChoose).toHaveBeenCalledWith('greek');
  });
});

describe('RecipeListItem', () => {
  const recipe: Recipe = {
    id: 'P1',
    name: 'Скир + яблоко',
    mealType: 'snack',
    defaultServings: 1,
    isBatch: false,
    prepNightBefore: false,
    totalMinutes: 2,
    imageKey: null,
    tags: [],
    sortOrder: 0,
  };

  it('shows macros, status and the kcal left after eating, and opens the recipe', async () => {
    const user = userEvent.setup();
    await wrap(
      <RecipeListItem
        recipe={recipe}
        macros={{ kcal: 188, protein: 17 }}
        check={checkWith({})}
        kcalLeftToday={828}
      />,
    );
    expect(screen.getByText('188 ккал · 17 г белка · 2 мин')).toBeOnTheScreen();
    expect(screen.getByText('Не хватает 1')).toBeOnTheScreen();
    expect(screen.getByText('останется 640')).toBeOnTheScreen();

    await user.press(screen.getByText('Скир + яблоко'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/recipe/[id]', params: { id: 'P1' } });
  });

  it('warns when the dish would exceed the day', async () => {
    await wrap(
      <RecipeListItem
        recipe={recipe}
        macros={{ kcal: 188, protein: 17 }}
        check={checkWith({ skyr: 150 })}
        kcalLeftToday={100}
      />,
    );
    expect(screen.getByText('Всё есть')).toBeOnTheScreen();
    expect(screen.getByText('перебор 88')).toBeOnTheScreen();
  });
});
