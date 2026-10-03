import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';

import type { IngredientCategory } from '@/domain/types';
import { CATEGORY_ICONS, useCategoryLabel } from '@/features/ingredients';
import { useT } from '@/i18n';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

type Props = {
  category: IngredientCategory;
  count: number;
  /** A photo of the category's most needed product, if any has one. */
  cover: number | { uri: string } | undefined;
  onPress: (category: IngredientCategory) => void;
};

/** A category on «Добавить домой»: photo, name and how many products it holds. */
export const CategoryCard = memo(function CategoryCard({ category, count, cover, onPress }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const label = useCategoryLabel()(category);
  const countText = t('products.count', { count });
  return (
    <TouchableRipple
      onPress={() => onPress(category)}
      borderless
      style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${countText}`}>
      <View>
        <ImageWithFallback
          source={cover}
          fallbackIcon={CATEGORY_ICONS[category]}
          style={styles.image}
          iconSize={36}
        />
        <View style={styles.body}>
          <Text variant="titleSmall" numberOfLines={2} style={styles.name}>
            {label}
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {countText}
          </Text>
        </View>
      </View>
    </TouchableRipple>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 16 / 10 },
  body: { padding: spacing.sm, gap: 2 },
  name: { minHeight: 40 },
});
