import { useState } from 'react';
import { IconButton, Menu } from 'react-native-paper';

import { useT } from '@/i18n';

type Props = { hidden: boolean; onHide: () => void; onUnhide: () => void };

/** ⋮ on the recipe card: «Скрыть это блюдо» / «Показывать снова». */
export function RecipeMenu({ hidden, onHide, onUnhide }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={
        <IconButton
          icon="dots-vertical"
          onPress={() => setOpen(true)}
          accessibilityLabel={t('recipes.card.menuA11y')}
        />
      }>
      {hidden ? (
        <Menu.Item
          leadingIcon="eye-outline"
          title={t('recipes.card.unhide')}
          onPress={run(onUnhide)}
        />
      ) : (
        <Menu.Item
          leadingIcon="eye-off-outline"
          title={t('recipes.card.hide')}
          onPress={run(onHide)}
        />
      )}
    </Menu>
  );
}
