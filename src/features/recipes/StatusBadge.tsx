import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Chip } from 'react-native-paper';

import type { CookCheck } from '@/domain/pantry';
import { useT } from '@/i18n';
import { useAppTheme } from '@/theme';

export function StatusBadge({ check }: { check: CookCheck }) {
  const theme = useAppTheme();
  const t = useT();
  const ok = check.status === 'ok';
  const color = ok ? theme.colors.success : theme.colors.warning;
  const label = ok
    ? t('recipes.status.allThere')
    : t('recipes.status.missing', { count: check.missing.length });

  return (
    <Chip
      compact
      icon={({ size }) => (
        <MaterialCommunityIcons
          name={ok ? 'check-circle-outline' : 'alert-circle-outline'}
          size={size}
          color={color}
        />
      )}
      textStyle={{ color }}
      style={{ backgroundColor: 'transparent' }}
      accessibilityLabel={ok ? t('recipes.status.allThereA11y') : label}>
      {label}
    </Chip>
  );
}
