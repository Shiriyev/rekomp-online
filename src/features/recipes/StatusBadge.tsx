import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Chip } from 'react-native-paper';

import type { CookCheck } from '@/domain/pantry';
import { useAppTheme } from '@/theme';

export function StatusBadge({ check }: { check: CookCheck }) {
  const theme = useAppTheme();
  const ok = check.status === 'ok';
  const color = ok ? theme.colors.success : theme.colors.warning;
  const label = ok ? 'Всё есть' : `Не хватает ${check.missing.length}`;

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
      accessibilityLabel={ok ? 'Все продукты есть' : label}>
      {label}
    </Chip>
  );
}
