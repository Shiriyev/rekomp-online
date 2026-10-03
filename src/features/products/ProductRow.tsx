import { router } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';

import type { Ingredient } from '@/db/schema';
import { bundledImage } from '@/features/bundledImage';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatDecimal, formatInt } from '@/lib/format';
import { radius, spacing, useAppTheme } from '@/theme';
import { ImageWithFallback } from '@/ui/ImageWithFallback';

type Props = {
  ingredient: Ingredient;
  /** Second line; defaults to kcal · protein per 100 g. */
  subtitle?: string | null;
  /** Highlighted second line (e.g. «заканчивается»). */
  warning?: boolean;
  /** Right side: an amount, a stepper, a check mark. */
  trailing?: ReactNode;
  onPress: () => void;
  selected?: boolean;
  accessibilityRole?: 'button' | 'checkbox';
};

/** Opens the product card; long-press on any product tile or row. */
export const openProductCard = (id: string) =>
  router.push({ pathname: '/product/[id]', params: { id } });

/** A product in list view: small photo, name, nutrition (or `subtitle`) and `trailing`. */
export const ProductRow = memo(function ProductRow({
  ingredient,
  subtitle,
  warning = false,
  trailing,
  onPress,
  selected,
  accessibilityRole = 'button',
}: Props) {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const name = content.ingredientName(ingredient);
  const second =
    subtitle ??
    t('products.per100', {
      kcal: formatInt(ingredient.kcalPer100g),
      protein: formatDecimal(ingredient.proteinPer100g),
    });
  return (
    <TouchableRipple
      onPress={onPress}
      onLongPress={() => openProductCard(ingredient.id)}
      accessibilityRole={accessibilityRole}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={`${name}, ${second}`}
      accessibilityActions={[{ name: 'longpress', label: t('products.card.openHint') }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'longpress') openProductCard(ingredient.id);
      }}
      style={[
        styles.row,
        selected ? { backgroundColor: theme.colors.secondaryContainer } : undefined,
      ]}>
      <View style={styles.inner}>
        <ImageWithFallback
          source={bundledImage(ingredient.imageKey)}
          fallbackIcon={CATEGORY_ICONS[ingredient.category]}
          style={styles.image}
          iconSize={22}
        />
        <View style={styles.text}>
          <Text variant="titleSmall" numberOfLines={1}>
            {name}
          </Text>
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={{ color: warning ? theme.colors.warning : theme.colors.onSurfaceVariant }}>
            {second}
          </Text>
        </View>
        {trailing}
      </View>
    </TouchableRipple>
  );
});

const styles = StyleSheet.create({
  row: { borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  image: { width: 48, height: 48, borderRadius: radius.sm },
  text: { flex: 1, gap: 1 },
});
