import { render, screen, userEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import type { Ingredient } from '@/db/schema';
import { lightTheme } from '@/theme';

import { NotInCatalog } from '../NotInCatalog';

const broccoli = { id: 'broccoli', name: 'Брокколи', nameEn: 'Broccoli' } as Ingredient;

const wrap = (ui: React.ReactElement) =>
  render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);

describe('NotInCatalog', () => {
  it('offers look-alikes and picks one', async () => {
    const user = userEvent.setup();
    const onPick = jest.fn();
    await wrap(<NotInCatalog suggestions={[broccoli]} onPick={onPick} />);
    expect(screen.getByText('Такого продукта нет в каталоге')).toBeOnTheScreen();
    expect(screen.getByText('Может быть, вы искали:')).toBeOnTheScreen();
    await user.press(screen.getByText('Брокколи'));
    expect(onPick).toHaveBeenCalledWith(broccoli);
  });

  it('asks for another name when nothing is similar', async () => {
    await wrap(<NotInCatalog suggestions={[]} onPick={jest.fn()} />);
    expect(screen.getByText(/Попробуйте другое название/)).toBeOnTheScreen();
  });
});
