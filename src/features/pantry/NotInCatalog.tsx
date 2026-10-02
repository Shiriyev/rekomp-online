import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';

import type { Ingredient } from '@/db/schema';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { spacing } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';

type Props = { suggestions: Ingredient[]; onPick: (ingredient: Ingredient) => void };

/**
 * Search found nothing: products come only from the catalog, so offer look-alikes
 * (typos, other word forms) instead of creating a new product.
 */
export function NotInCatalog({ suggestions, onPick }: Props) {
  const t = useT();
  const content = useContent();
  return (
    <View style={styles.box}>
      <EmptyState
        icon="magnify-close"
        title={t('pantry.notInCatalog.title')}
        description={
          suggestions.length > 0
            ? t('pantry.notInCatalog.maybe')
            : t('pantry.notInCatalog.tryOther')
        }
      />
      {suggestions.length > 0 ? (
        <View style={styles.chips}>
          {suggestions.map((i) => (
            <Chip key={i.id} mode="outlined" icon="arrow-right" onPress={() => onPick(i)}>
              {content.ingredientName(i)}
            </Chip>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, paddingBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
});
