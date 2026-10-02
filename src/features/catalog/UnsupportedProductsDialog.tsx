import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { repositories } from '@/db';
import { useUnsupportedProducts } from '@/db/hooks';
import { useT } from '@/i18n';

/**
 * Shown once after a catalog update that could not match some of the user's own products:
 * they stay in the history and at home, but are no longer offered when adding products.
 */
export function UnsupportedProductsDialog() {
  const t = useT();
  const names = useUnsupportedProducts();
  if (names.length === 0) return null;
  return (
    <Portal>
      <Dialog visible dismissable={false}>
        <Dialog.Title>{t('catalog.unsupported.title')}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{t('catalog.unsupported.text')}</Text>
          <Text variant="bodyLarge" style={{ marginTop: 12 }}>
            {names.join(', ')}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => repositories.settings.dismissUnsupportedProducts()}>
            {t('catalog.unsupported.ok')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
