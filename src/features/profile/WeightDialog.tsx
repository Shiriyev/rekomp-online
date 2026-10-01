import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';

import { planWeightChange, type Targets } from '@/domain/calculator';
import { parseDecimal, PROFILE_LIMITS } from '@/domain/schemas';
import type { Profile } from '@/db/schema';
import { useT } from '@/i18n';
import { formatDecimal, formatInt, formatKcal } from '@/lib/format';
import { spacing } from '@/theme';
import { useKeyboardHeight } from '@/ui/useKeyboardHeight';

type Props = {
  visible: boolean;
  profile: Profile;
  onDismiss: () => void;
  onSave: (next: Profile) => void;
};

const withTargets = (p: Profile, weightKg: number, t: Targets): Profile => ({
  ...p,
  weightKg,
  kcalTarget: t.kcalTarget,
  proteinTargetG: t.proteinTargetG,
  proteinMinG: t.proteinMinG,
  targetOverridden: false,
});

/** Quick weight update. Manual targets are only replaced after explicit confirmation. */
export function WeightDialog({ visible, profile, onDismiss, onSave }: Props) {
  const t = useT();
  const [text, setText] = useState(formatDecimal(profile.weightKg));
  const keyboardHeight = useKeyboardHeight();
  const [proposal, setProposal] = useState<{ weightKg: number; targets: Targets } | null>(null);

  const weight = parseDecimal(text);
  const { min, max } = PROFILE_LIMITS.weightKg;
  const valid = Number.isFinite(weight) && weight >= min && weight <= max;

  const close = () => {
    setProposal(null);
    onDismiss();
  };

  const submit = () => {
    if (!valid) return;
    const plan = planWeightChange(profile, weight);
    if (plan.kind === 'recalculated') {
      onSave(withTargets(profile, weight, plan.targets));
      close();
    } else {
      setProposal({ weightKg: weight, targets: plan.proposed });
    }
  };

  return (
    <Portal>
      {/* Dialogs are centred: a bottom margin equal to the keyboard keeps the actions visible. */}
      <Dialog visible={visible} onDismiss={close} style={{ marginBottom: keyboardHeight }}>
        <Dialog.Title>
          {proposal ? t('profile.weightDialog.recalcTitle') : t('profile.weightDialog.title')}
        </Dialog.Title>
        {proposal ? (
          <>
            <Dialog.Content style={styles.content}>
              <Text variant="bodyMedium">
                {t('profile.weightDialog.manualTargets', {
                  kcal: formatKcal(profile.kcalTarget),
                  min: formatInt(profile.proteinMinG),
                  target: formatInt(profile.proteinTargetG),
                })}
              </Text>
              <Text variant="bodyMedium">
                {t('profile.weightDialog.proposed', {
                  kcal: formatKcal(proposal.targets.kcalTarget),
                  min: formatInt(proposal.targets.proteinMinG),
                  target: formatInt(proposal.targets.proteinTargetG),
                })}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => {
                  onSave({ ...profile, weightKg: proposal.weightKg });
                  close();
                }}>
                {t('profile.weightDialog.keepMine')}
              </Button>
              <Button
                mode="contained"
                onPress={() => {
                  onSave(withTargets(profile, proposal.weightKg, proposal.targets));
                  close();
                }}>
                {t('profile.recalculate')}
              </Button>
            </Dialog.Actions>
          </>
        ) : (
          <>
            <Dialog.Content>
              <TextInput
                mode="outlined"
                label={t('profile.weightDialog.label')}
                accessibilityLabel={t('profile.weightDialog.label')}
                value={text}
                onChangeText={setText}
                keyboardType="decimal-pad"
                right={<TextInput.Affix text={t('profile.weightDialog.suffix')} />}
                error={!valid}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              <HelperText type="error" visible={!valid} padding="none">
                {t('profile.weightDialog.range', {
                  min: formatDecimal(min),
                  max: formatDecimal(max),
                })}
              </HelperText>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={close}>{t('common.actions.cancel')}</Button>
              <Button mode="contained" onPress={submit} disabled={!valid}>
                {t('common.actions.save')}
              </Button>
            </Dialog.Actions>
          </>
        )}
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.sm } });
