import { render, screen, userEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { lightTheme } from '@/theme';

import { DayCard } from '../DayCard';

// Entries are only queried when expanded; keep the DB out of this test.
jest.mock('@/db/hooks', () => ({ useDayLogs: () => [] }));

const targets = { kcalTarget: 2150, proteinMinG: 120 };

const renderCard = (
  totals: { kcal: number; protein: number },
  expanded = false,
  onToggle = jest.fn(),
) =>
  render(
    <PaperProvider theme={lightTheme}>
      <DayCard
        label="Вчера"
        localDate="2026-09-26"
        totals={totals}
        targets={targets}
        expanded={expanded}
        onToggle={onToggle}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    </PaperProvider>,
  );

describe('DayCard', () => {
  it('summarises the day against the targets', async () => {
    await renderCard({ kcal: 2100, protein: 131 });
    expect(screen.getByText('2 100 / 2 150 ккал')).toBeOnTheScreen();
    expect(screen.getByText('131 г белка')).toBeOnTheScreen();
    expect(screen.getByLabelText(/Вчера: 2 100 килокалорий, в норме/)).toBeOnTheScreen();
  });

  it('describes over and under days', async () => {
    await renderCard({ kcal: 5700, protein: 36 });
    expect(screen.getByLabelText(/перебор/)).toBeOnTheScreen();
    await renderCard({ kcal: 900, protein: 36 });
    expect(screen.getByLabelText(/мало/)).toBeOnTheScreen();
  });

  it('toggles and shows an empty day', async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    await renderCard({ kcal: 0, protein: 0 }, true, onToggle);
    expect(screen.getByText('Записей нет')).toBeOnTheScreen();
    await user.press(screen.getByText('Вчера'));
    expect(onToggle).toHaveBeenCalled();
  });
});
