import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { summarizeDay } from '@/domain/today';
import { lightTheme } from '@/theme';

import { TodaySummaryCard } from '../TodaySummaryCard';

const targets = { kcalTarget: 2150, proteinTargetG: 140, proteinMinG: 120 };

const renderCard = (logs: Parameters<typeof summarizeDay>[0]) =>
  render(
    <PaperProvider theme={lightTheme}>
      <TodaySummaryCard summary={summarizeDay(logs)} targets={targets} />
    </PaperProvider>,
  );

describe('TodaySummaryCard', () => {
  it('shows eaten vs target, what is left and the per-meal breakdown', async () => {
    await renderCard([
      { mealType: 'breakfast', kcal: 620, protein: 49 },
      { mealType: 'snack', kcal: 250, protein: 4.3 },
    ]);

    expect(screen.getByLabelText('Калории: 870 из 2 150')).toBeOnTheScreen();
    expect(screen.getByText('Осталось 1 280 ккал')).toBeOnTheScreen();
    expect(screen.getByLabelText('Белок: 53 из 140 грамм')).toBeOnTheScreen();
    expect(screen.getByText('До минимума 67 г')).toBeOnTheScreen();
    expect(screen.getByText('620')).toBeOnTheScreen();
    expect(screen.getByText('250')).toBeOnTheScreen();
  });

  it('reports going over the kcal target and meeting protein', async () => {
    await renderCard([
      { mealType: 'lunch', kcal: 1500, protein: 90 },
      { mealType: 'dinner', kcal: 800, protein: 55 },
    ]);

    expect(screen.getByText('Перебор 150 ккал')).toBeOnTheScreen();
    expect(screen.getByText('Белок на сегодня есть ✓')).toBeOnTheScreen();
  });

  it('points to the target once the minimum is met', async () => {
    await renderCard([{ mealType: 'lunch', kcal: 900, protein: 125 }]);
    expect(screen.getByText('До цели 15 г')).toBeOnTheScreen();
  });
});
