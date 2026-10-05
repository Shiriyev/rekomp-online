import { getLogicalDate } from '../day';
import {
  DEFAULT_STORAGE_DAYS,
  defaultServingsFor,
  exceedsStorage,
  isHeatStep,
  needsBigPotHint,
  portionFreshness,
  SERVING_CHOICES,
} from '../servings';

describe('defaultServingsFor', () => {
  it('is 3 for lunch and 1 for every other meal', () => {
    expect(defaultServingsFor('lunch')).toBe(3);
    expect(defaultServingsFor('breakfast')).toBe(1);
    expect(defaultServingsFor('dinner')).toBe(1);
    expect(defaultServingsFor('snack')).toBe(1);
  });

  it('offers 1–6 portions', () => {
    expect(SERVING_CHOICES).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('exceedsStorage', () => {
  it('warns when there are more portions than storage days + 1', () => {
    expect(exceedsStorage(2, 1)).toBe(false);
    expect(exceedsStorage(3, 1)).toBe(true);
    expect(exceedsStorage(4, 3)).toBe(false);
    expect(exceedsStorage(5, 3)).toBe(true);
  });
});

describe('isHeatStep / needsBigPotHint', () => {
  it('finds boiling, frying and stewing in Russian or English', () => {
    expect(isHeatStep({ text: 'Вари пасту 9 мин' })).toBe(true);
    expect(isHeatStep({ text: 'Обжарь лук на масле' })).toBe(true);
    expect(isHeatStep({ text: 'Туши под крышкой' })).toBe(true);
    expect(isHeatStep({ text: 'Подготовь', textEn: 'Bring to a boil' })).toBe(true);
    expect(isHeatStep({ text: 'Нарежь лук', textEn: 'Chop the onion' })).toBe(false);
    expect(isHeatStep({ text: 'Нарежь лук', textEn: null })).toBe(false);
  });

  it('trusts the step heat level when the catalog has it', () => {
    expect(isHeatStep({ text: 'Нарежь лук', heat: 'medium' })).toBe(true);
    expect(isHeatStep({ text: 'Вари пасту', heat: null })).toBe(false);
  });

  it('shows the hint only from 3 portions on a heat step', () => {
    const fry = { text: 'Жарь фарш 7–8 мин' };
    expect(needsBigPotHint(2, fry)).toBe(false);
    expect(needsBigPotHint(3, fry)).toBe(true);
    expect(needsBigPotHint(6, { text: 'Разложи по тарелкам' })).toBe(false);
  });
});

describe('portionFreshness', () => {
  it('is good until the cooking day + storage days', () => {
    expect(portionFreshness('2026-10-05', 3, '2026-10-05')).toEqual({
      bestBefore: '2026-10-08',
      daysLeft: 3,
      expired: false,
    });
    expect(portionFreshness('2026-10-05', 1, '2026-10-06')).toMatchObject({
      daysLeft: 0,
      expired: false,
    });
    expect(portionFreshness('2026-10-05', 1, '2026-10-07')).toMatchObject({
      daysLeft: -1,
      expired: true,
    });
  });

  it('falls back to 3 days for portions without storage days', () => {
    expect(portionFreshness('2026-10-05', null, '2026-10-05').bestBefore).toBe(
      `2026-10-0${5 + DEFAULT_STORAGE_DAYS}`,
    );
  });

  it('counts logical days: a night before 04:00 still belongs to the previous day', () => {
    const tz = 'Europe/Budapest';
    // Cooked at 02:30 on 6 Oct → logical 5 Oct; keeps 1 day → good until 6 Oct.
    const cookedOn = getLogicalDate(Date.parse('2026-10-06T02:30:00+02:00'), 4, tz);
    expect(cookedOn).toBe('2026-10-05');
    const at = (iso: string) => getLogicalDate(Date.parse(iso), 4, tz);
    expect(portionFreshness(cookedOn, 1, at('2026-10-07T03:30:00+02:00')).expired).toBe(false);
    expect(portionFreshness(cookedOn, 1, at('2026-10-07T04:30:00+02:00')).expired).toBe(true);
  });
});
