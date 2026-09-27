import { render, screen, userEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { lightTheme } from '@/theme';

import { FinishView } from '../FinishView';
import { TimerCard } from '../TimerCard';

jest.mock('react-native-confetti-cannon', () => () => null);

const wrap = (ui: React.ReactElement) =>
  render(<PaperProvider theme={lightTheme}>{ui}</PaperProvider>);

describe('TimerCard', () => {
  const handlers = () => ({ onStart: jest.fn(), onPause: jest.fn(), onReset: jest.fn() });

  it('shows the full duration and a start button before first use', async () => {
    const h = handlers();
    const user = userEvent.setup();
    await wrap(<TimerCard durationSec={540} timer={undefined} now={0} {...h} />);
    expect(screen.getByText('9:00')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Сбросить таймер')).toBeNull();
    await user.press(screen.getByText('Старт'));
    expect(h.onStart).toHaveBeenCalled();
  });

  it('counts down while running and offers pause and reset', async () => {
    const h = handlers();
    const user = userEvent.setup();
    const timer = {
      stepOrder: 1,
      durationSec: 540,
      startedAt: 0,
      elapsedSec: 0,
      notificationId: null,
    };
    await wrap(<TimerCard durationSec={540} timer={timer} now={60_500} {...h} />);
    expect(screen.getByText('8:00')).toBeOnTheScreen();
    await user.press(screen.getByText('Пауза'));
    expect(h.onPause).toHaveBeenCalled();
    await user.press(screen.getByLabelText('Сбросить таймер'));
    expect(h.onReset).toHaveBeenCalled();
  });

  it('offers to resume a paused timer and shows done state at zero', async () => {
    const paused = {
      stepOrder: 1,
      durationSec: 300,
      startedAt: null,
      elapsedSec: 100,
      notificationId: null,
    };
    await wrap(<TimerCard durationSec={300} timer={paused} now={0} {...handlers()} />);
    expect(screen.getByText('3:20')).toBeOnTheScreen();
    expect(screen.getByText('Продолжить')).toBeOnTheScreen();

    const done = { ...paused, startedAt: 0, elapsedSec: 0 };
    await wrap(<TimerCard durationSec={300} timer={done} now={300_000} {...handlers()} />);
    expect(screen.getByLabelText('Таймер готов')).toBeOnTheScreen();
    expect(screen.getByText('Ещё раз')).toBeOnTheScreen();
  });
});

describe('FinishView', () => {
  const props = {
    recipeName: 'Курица с рисом',
    perPortion: { kcal: 709, protein: 61.4 },
    onEatNow: jest.fn(),
    onStoreAll: jest.fn(),
    onBack: jest.fn(),
  };

  it('offers eat-now or store-all for a batch with correct plural and the first-cook badge', async () => {
    const user = userEvent.setup();
    await wrap(<FinishView {...props} servings={3} isBatch firstTime />);
    expect(screen.getByText('+709 ккал, +61 г белка')).toBeOnTheScreen();
    expect(screen.getByText('Первая готовка этого блюда')).toBeOnTheScreen();
    await user.press(screen.getByText('Съесть сейчас 1 порцию'));
    expect(props.onEatNow).toHaveBeenCalled();
    await user.press(screen.getByText('Убрать все 3 порции в холодильник'));
    expect(props.onStoreAll).toHaveBeenCalled();
  });

  it('uses single-portion wording otherwise', async () => {
    await wrap(<FinishView {...props} servings={1} isBatch={false} firstTime={false} />);
    expect(screen.getByText('Съесть сейчас')).toBeOnTheScreen();
    expect(screen.getByText('Убрать в холодильник')).toBeOnTheScreen();
    expect(screen.queryByText('Первая готовка этого блюда')).toBeNull();
  });
});
