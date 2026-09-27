import { render, screen, userEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { lightTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';

const renderWithTheme = (ui: React.ReactElement) =>
  render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);

describe('EmptyState', () => {
  it('renders title, description and fires the action', async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();
    await renderWithTheme(
      <EmptyState
        icon="fridge-outline"
        title="Пусто"
        description="Добавьте продукт"
        actionLabel="Добавить"
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Пусто')).toBeOnTheScreen();
    expect(screen.getByText('Добавьте продукт')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Добавить' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('hides the button when no action is given', async () => {
    await renderWithTheme(<EmptyState icon="fridge-outline" title="Пусто" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
