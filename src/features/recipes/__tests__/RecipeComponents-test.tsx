import { render, screen, userEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import type { Ingredient, RecipeIngredient } from '@/db/schema';
import { canCook } from '@/domain/pantry';
import { lightTheme } from '@/theme';

import { IngredientRow } from '../IngredientRow';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const ingredient = (id: string, name: string, over: Partial<Ingredient> = {}): Ingredient => ({
  id,
  name,
  nameHu: null,
  category: 'dairy_eggs',
  unit: 'g',
  gramsPerPiece: null,
  kcalPer100g: 63,
  proteinPer100g: 11,
  isStaple: false,
  stockTracked: true,
  imageKey: null,
  isCustom: false,
  lowStockThreshold: null,
  lastAddedAmount: null,
  nameEn: null,
  synonyms: [],
  subcategory: null,
  fatPer100g: null,
  carbsPer100g: null,
  tags: [],
  source: 'own',
  sourceId: null,
  isArchived: false,
  nutritionEdited: false,
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
  noteEn: null,
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
        servings={1}
        onChooseAlternative={jest.fn()}
      />,
    );
    expect(screen.getByLabelText(label)).toBeOnTheScreen();
  });

  it('scales the total and the status with servings and the drafted amount', async () => {
    const stock = new Map([['skyr', { quantity: 500, unit: 'g' as const }]]);
    const rowFor = (servings: number, perServing: number) => {
      const lines = [line('skyr', perServing)];
      const check = canCook(lines, INGREDIENTS, stock, servings).lines[0]!;
      return (
        <PaperProvider theme={lightTheme}>
          <IngredientRow
            check={check}
            ingredient={SKYR}
            alternatives={[]}
            servings={servings}
            onChooseAlternative={jest.fn()}
            editor={{ value: perServing, base: 150, step: 10, onChange: jest.fn() }}
          />
        </PaperProvider>
      );
    };
    const view = await render(rowFor(1, 150));
    expect(screen.queryByText('на порцию')).toBeNull();
    expect(screen.getByLabelText('Скир, 150 г, есть')).toBeOnTheScreen();

    await view.rerender(rowFor(3, 150));
    expect(screen.getByText('на порцию')).toBeOnTheScreen();
    expect(screen.getByText('всего 450 г')).toBeOnTheScreen();
    expect(screen.getByLabelText('Скир, 450 г, есть')).toBeOnTheScreen();

    // A drafted 200 g per serving: 600 g in total, more than the 500 g at home.
    await view.rerender(rowFor(3, 200));
    expect(screen.getByText('всего 600 г')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Скир, 600 г, мало: 500 г/)).toBeOnTheScreen();
  });

  it('lets the user pick an alternative', async () => {
    const user = userEvent.setup();
    const onChoose = jest.fn();
    await wrap(
      <IngredientRow
        check={checkWith({ skyr: 200 }).lines[0]!}
        ingredient={SKYR}
        alternatives={[GREEK]}
        servings={1}
        onChooseAlternative={onChoose}
      />,
    );
    await user.press(screen.getByText('или Греческий йогурт'));
    expect(onChoose).toHaveBeenCalledWith('greek');
  });
});
