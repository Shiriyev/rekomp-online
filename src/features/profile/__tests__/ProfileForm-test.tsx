import { render, screen, userEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { calculateTargets } from '@/domain/calculator';
import { AGREED_TARGETS } from '@/domain/profile';
import type { ProfileInput } from '@/domain/schemas';
import { lightTheme } from '@/theme';

import { ProfileForm } from '../ProfileForm';
import { profileToFormValues } from '../profileFormSchema';

const setup = async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn<void, [ProfileInput]>();
  await render(
    <PaperProvider theme={lightTheme}>
      <ProfileForm
        defaultValues={profileToFormValues(undefined, AGREED_TARGETS)}
        submitLabel="Начать"
        onSubmit={onSubmit}
      />
    </PaperProvider>,
  );
  const fillBody = async () => {
    await user.press(screen.getByText('Мужской'));
    await user.type(screen.getByLabelText('Возраст'), '30');
    await user.type(screen.getByLabelText('Рост'), '180');
    await user.type(screen.getByLabelText('Вес'), '85,5');
    await user.press(screen.getByLabelText(/^Средняя\./));
  };
  return { user, onSubmit, fillBody };
};

describe('ProfileForm', () => {
  it('submits calculated targets and shows a live preview', async () => {
    const { user, onSubmit, fillBody } = await setup();
    await fillBody();

    const body = { sex: 'male' as const, age: 30, heightCm: 180, weightKg: 85.5 };
    const expected = calculateTargets(body, 'moderate', -0.5);
    expect(screen.getByLabelText(`Цель ${expected.kcalTarget} килокалорий`)).toBeOnTheScreen();

    await user.press(screen.getByText('Начать'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      ...body,
      activityLevel: 'moderate',
      goalRateKgPerWeek: -0.5,
      kcalTarget: expected.kcalTarget,
      proteinTargetG: expected.proteinTargetG,
      proteinMinG: expected.proteinMinG,
      targetOverridden: false,
    });
  });

  it('submits manual targets prefilled with the agreed values', async () => {
    const { user, onSubmit, fillBody } = await setup();
    await fillBody();
    await user.press(screen.getByText('Свои значения'));
    expect(screen.getByLabelText('Калории')).toHaveDisplayValue('2150');

    await user.press(screen.getByText('Начать'));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      kcalTarget: 2150,
      proteinTargetG: 140,
      proteinMinG: 120,
      targetOverridden: true,
    });
  });

  it('shows validation errors and does not submit', async () => {
    const { user, onSubmit } = await setup();
    await user.type(screen.getByLabelText('Возраст'), '12');
    await user.press(screen.getByText('Начать'));

    expect(await screen.findByText('Выберите пол')).toBeOnTheScreen();
    expect(screen.getByText('Не меньше 16')).toBeOnTheScreen();
    expect(screen.getByText('Выберите активность')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('validates manual protein min against target', async () => {
    const { user, onSubmit, fillBody } = await setup();
    await fillBody();
    await user.press(screen.getByText('Свои значения'));
    await user.clear(screen.getByLabelText('Белок, минимум'));
    await user.type(screen.getByLabelText('Белок, минимум'), '160');
    await user.press(screen.getByText('Начать'));

    expect(await screen.findByText('Минимум не может быть больше цели')).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
