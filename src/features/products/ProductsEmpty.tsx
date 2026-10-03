import { EmptyState } from '@/ui/EmptyState';
import { useT } from '@/i18n';

import type { ProductBrowser } from './useProductBrowser';

/**
 * Nothing to show: after a search, the catalog has no such product (products are never
 * created by hand); otherwise the filters left nothing. Both offer «Сбросить».
 */
export function ProductsEmpty({
  browser,
  onReset,
}: {
  browser: ProductBrowser;
  onReset?: () => void;
}) {
  const t = useT();
  const searched = browser.query.trim() !== '';
  return (
    <EmptyState
      icon="magnify-close"
      title={searched ? t('pantry.notInCatalog.title') : t('products.nothing')}
      description={searched ? t('pantry.notInCatalog.tryOther') : t('products.nothingHint')}
      actionLabel={t('products.reset')}
      onAction={() => {
        browser.reset();
        browser.setQuery('');
        onReset?.();
      }}
    />
  );
}
