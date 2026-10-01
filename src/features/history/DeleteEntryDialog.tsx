import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { useIngredientsMap } from '@/db/hooks';
import { useT } from '@/i18n';
import { useContent } from '@/i18n/content';
import { formatAmount } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

import {
  deleteCookedWithProducts,
  deleteEntryOnly,
  deleteSimple,
  type DeletePlan,
} from './deleteEntry';

type Props = { plan: DeletePlan | null; onDone: () => void };

export function DeleteEntryDialog({ plan, onDone }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const content = useContent();
  const ingredients = useIngredientsMap();
  const productName = (id: string) => {
    const ingredient = ingredients.get(id);
    return ingredient ? content.ingredientName(ingredient) : id;
  };
  const run = (fn: () => void) => {
    fn();
    onDone();
  };

  return (
    <Portal>
      <Dialog visible={plan !== null} onDismiss={onDone}>
        <Dialog.Title>
          {t('history.delete.title', { name: plan ? content.entryName(plan.log) : '' })}
        </Dialog.Title>
        <Dialog.Content style={styles.content}>
          {plan?.kind === 'simple' ? <Text variant="bodyMedium">{plan.message}</Text> : null}
          {plan?.kind === 'cooked' && plan.preview.canUndo ? (
            <>
              <Text variant="bodyMedium">
                {plan.preview.products.length > 0
                  ? t('history.delete.cookedReturn')
                  : t('history.delete.cookedNothing')}
              </Text>
              {plan.preview.products.map((p) => (
                <Text key={p.ingredientId} variant="bodyMedium">
                  {t('history.delete.product', {
                    name: productName(p.ingredientId),
                    amount: formatAmount(p.amount, p.unit),
                  })}
                </Text>
              ))}
              {plan.preview.portionsToRemove > 0 ? (
                <Text variant="bodyMedium" style={{ color: theme.colors.warning }}>
                  {t('history.delete.portionsRemoved', {
                    n: plan.preview.portionsToRemove,
                  })}
                </Text>
              ) : null}
            </>
          ) : null}
          {plan?.kind === 'manualProducts' ? (
            <>
              <Text variant="bodyMedium">{t('history.delete.manualReturn')}</Text>
              {plan.products.map((p) => (
                <Text key={p.ingredientId} variant="bodyMedium">
                  {t('history.delete.product', {
                    name: productName(p.ingredientId),
                    amount: formatAmount(p.amount, p.unit),
                  })}
                </Text>
              ))}
            </>
          ) : null}
          {plan?.kind === 'cooked' && !plan.preview.canUndo ? (
            <Text variant="bodyMedium">
              {plan.preview.reason === 'portions_eaten'
                ? t('history.delete.portionsEaten')
                : t('history.delete.entryOnlyNote')}
            </Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button onPress={onDone}>{t('common.actions.cancel')}</Button>
          {plan?.kind === 'simple' ? (
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              onPress={() => run(() => deleteSimple(plan.log))}>
              {t('common.actions.delete')}
            </Button>
          ) : null}
          {/* Dialog.Actions passes props to direct children, so no fragments here. */}
          {plan?.kind === 'cooked' || plan?.kind === 'manualProducts' ? (
            <Button
              textColor={theme.colors.error}
              onPress={() => run(() => deleteEntryOnly(plan.log))}>
              {t('history.delete.entryOnly')}
            </Button>
          ) : null}
          {plan?.kind === 'manualProducts' ? (
            <Button mode="contained" onPress={() => run(() => deleteSimple(plan.log))}>
              {t('history.delete.deleteAndReturn')}
            </Button>
          ) : null}
          {plan?.kind === 'cooked' && plan.preview.canUndo ? (
            <Button mode="contained" onPress={() => run(() => deleteCookedWithProducts(plan.log))}>
              {t('history.delete.deleteAndReturn')}
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
