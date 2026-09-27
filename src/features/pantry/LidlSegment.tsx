import { FlashList } from '@shopify/flash-list';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, FAB, List, Text } from 'react-native-paper';

import { useIngredientsMap, useLidlProducts } from '@/db/hooks';
import type { LidlProduct } from '@/db/schema';
import { isSaleActive } from '@/domain/lidl';
import { CATEGORY_ICONS } from '@/features/ingredients';
import { formatAmount, formatDayMonth, formatInt } from '@/lib/format';
import { useClock } from '@/lib/useClock';
import { spacing, useAppTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';

import { LidlProductSheet, type LidlProductSheetHandle } from './LidlProductSheet';

export function LidlSegment() {
  const theme = useAppTheme();
  const { today } = useClock();
  const products = useLidlProducts();
  const ingredients = useIngredientsMap();
  const sheetRef = useRef<LidlProductSheetHandle>(null);
  const openSheet = (p: LidlProduct | null) => sheetRef.current?.open(p);

  // Active sales first, then by title.
  const sorted = [...products].sort(
    (a, b) =>
      Number(isSaleActive(b, today)) - Number(isSaleActive(a, today)) ||
      a.title.localeCompare(b.title, 'hu'),
  );

  return (
    <View style={styles.flex}>
      {sorted.length === 0 ? (
        <EmptyState
          icon="store-outline"
          title="Каталог пуст"
          description="Добавь товары Lidl с размером упаковки — «купил» будет класть домой целые упаковки."
          actionLabel="Добавить товар"
          onAction={() => openSheet(null)}
        />
      ) : (
        <FlashList
          data={sorted}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text
              variant="bodySmall"
              style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              Цены и скидки вводятся вручную. Просроченные скидки снимаются сами.
            </Text>
          }
          renderItem={({ item: p }) => {
            const ingredient = ingredients.get(p.ingredientId);
            const sale = isSaleActive(p, today);
            const details = [
              formatAmount(p.packageSize, p.packageUnit),
              p.priceHuf !== null ? `${formatInt(p.priceHuf)} Ft` : null,
              ingredient?.name,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <List.Item
                title={p.title}
                description={details}
                onPress={() => openSheet(p)}
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon={ingredient ? CATEGORY_ICONS[ingredient.category] : 'tag-outline'}
                  />
                )}
                right={() =>
                  sale ? (
                    <Chip
                      compact
                      icon="sale"
                      style={{ backgroundColor: theme.colors.secondaryContainer }}>
                      {p.saleUntil ? `до ${formatDayMonth(p.saleUntil)}` : 'скидка'}
                    </Chip>
                  ) : null
                }
                style={styles.item}
              />
            );
          }}
        />
      )}
      <FAB
        icon="plus"
        label="Товар"
        style={styles.fab}
        onPress={() => openSheet(null)}
        accessibilityLabel="Добавить товар Lidl"
      />
      <LidlProductSheet ref={sheetRef} ingredients={[...ingredients.values()]} today={today} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 96 },
  hint: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  item: { paddingLeft: spacing.sm, minHeight: 64 },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
});
