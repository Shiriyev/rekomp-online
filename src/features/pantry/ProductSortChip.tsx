import { Chip } from 'react-native-paper';

import { useT } from '@/i18n';

import { useProductSort } from './productSort';

/** Switches «Чаще нужны» ↔ «По алфавиту»; first chip in the product chip rows. */
export function ProductSortChip() {
  const t = useT();
  const sort = useProductSort((s) => s.sort);
  const set = useProductSort((s) => s.set);
  return (
    <Chip
      compact
      icon="sort"
      mode="outlined"
      onPress={() => set(sort === 'popular' ? 'alpha' : 'popular')}
      accessibilityHint={t(sort === 'popular' ? 'pantry.sort.alpha' : 'pantry.sort.popular')}>
      {t(`pantry.sort.${sort}`)}
    </Chip>
  );
}
