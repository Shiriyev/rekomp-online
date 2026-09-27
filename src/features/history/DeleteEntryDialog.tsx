import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { useIngredientsMap } from '@/db/hooks';
import { formatAmount } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

import {
  deleteCookedEntryOnly,
  deleteCookedWithProducts,
  deleteSimple,
  type DeletePlan,
} from './deleteEntry';

type Props = { plan: DeletePlan | null; onDone: () => void };

export function DeleteEntryDialog({ plan, onDone }: Props) {
  const theme = useAppTheme();
  const ingredients = useIngredientsMap();
  const run = (fn: () => void) => {
    fn();
    onDone();
  };

  return (
    <Portal>
      <Dialog visible={plan !== null} onDismiss={onDone}>
        <Dialog.Title>Удалить «{plan?.log.name}»?</Dialog.Title>
        <Dialog.Content style={styles.content}>
          {plan?.kind === 'simple' ? <Text variant="bodyMedium">{plan.message}</Text> : null}
          {plan?.kind === 'cooked' && plan.preview.canUndo ? (
            <>
              <Text variant="bodyMedium">
                {plan.preview.products.length > 0
                  ? 'Это блюдо из готовки. Вернуть продукты домой?'
                  : 'Это блюдо из готовки. Дома тогда ничего не списалось — возвращать нечего.'}
              </Text>
              {plan.preview.products.map((p) => (
                <Text key={p.ingredientId} variant="bodyMedium">
                  • {ingredients.get(p.ingredientId)?.name ?? p.ingredientId}: +
                  {formatAmount(p.amount, p.unit)}
                </Text>
              ))}
              {plan.preview.portionsToRemove > 0 ? (
                <Text variant="bodyMedium" style={{ color: theme.colors.warning }}>
                  Из холодильника уберутся порции этой готовки: {plan.preview.portionsToRemove}.
                </Text>
              ) : null}
            </>
          ) : null}
          {plan?.kind === 'cooked' && !plan.preview.canUndo ? (
            <Text variant="bodyMedium">
              {plan.preview.reason === 'portions_eaten'
                ? 'Порции из этой кастрюли уже ели, поэтому продукты вернуть нельзя — удалится только запись.'
                : 'Удалится только запись.'}
            </Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDone}>Отмена</Button>
          {plan?.kind === 'simple' ? (
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              onPress={() => run(() => deleteSimple(plan.log))}>
              Удалить
            </Button>
          ) : null}
          {/* Dialog.Actions passes props to direct children, so no fragments here. */}
          {plan?.kind === 'cooked' ? (
            <Button
              textColor={theme.colors.error}
              onPress={() => run(() => deleteCookedEntryOnly(plan.log))}>
              Только запись
            </Button>
          ) : null}
          {plan?.kind === 'cooked' && plan.preview.canUndo ? (
            <Button mode="contained" onPress={() => run(() => deleteCookedWithProducts(plan.log))}>
              Удалить и вернуть
            </Button>
          ) : null}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xs },
  actions: { flexWrap: 'wrap' },
});
