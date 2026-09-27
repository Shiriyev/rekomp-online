import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  HelperText,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';
import { z } from 'zod';

import { repositories } from '@/db';
import { DuplicateBarcodeError } from '@/db/repositories/lidlRepo';
import type { Ingredient, LidlProduct } from '@/db/schema';
import { addDays, parseDayMonth } from '@/domain/dates';
import { searchIngredients } from '@/domain/search';
import { UNITS } from '@/domain/types';
import { numberText, optionalNumberText } from '@/features/forms/numberText';
import { formatDayMonth } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';
import { AppBottomSheet } from '@/ui/AppBottomSheet';
import { NumberField } from '@/ui/NumberField';
import { sheetInput } from '@/ui/sheetInput';

const formSchema = z.object({
  ingredientId: z.string().min(1, 'Выберите продукт'),
  title: z.string().trim().min(1, 'Введите название').max(80),
  packageSize: numberText({ min: 0.5, max: 100_000 }),
  packageUnit: z.enum(UNITS),
  priceHuf: optionalNumberText({ min: 0, max: 1_000_000 }, true),
  onSale: z.boolean(),
  saleUntil: z.string(),
  barcode: z.string(),
  notes: z.string(),
});
type Values = z.input<typeof formSchema>;

export type LidlProductSheetHandle = { open: (product: LidlProduct | null) => void };

type Props = { ref: Ref<LidlProductSheetHandle>; ingredients: Ingredient[]; today: string };

const empty: Values = {
  ingredientId: '',
  title: '',
  packageSize: '',
  packageUnit: 'g',
  priceHuf: '',
  onSale: false,
  saleUntil: '',
  barcode: '',
  notes: '',
};

export function LidlProductSheet({ ref, ingredients, today }: Props) {
  const theme = useAppTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [product, setProduct] = useState<LidlProduct | null>(null);
  const [query, setQuery] = useState('');
  const { control, handleSubmit, reset, setValue, setError } = useForm<
    Values,
    unknown,
    z.output<typeof formSchema>
  >({
    resolver: zodResolver(formSchema),
    defaultValues: empty,
  });
  const [ingredientId, onSale] = useWatch({ control, name: ['ingredientId', 'onSale'] });
  const linked = ingredients.find((i) => i.id === ingredientId);
  const matches = useMemo(
    () =>
      query.trim()
        ? searchIngredients(
            ingredients.filter((i) => !i.isStaple),
            query,
          ).slice(0, 5)
        : [],
    [ingredients, query],
  );

  const fill = (product: LidlProduct | null) => {
    setQuery('');
    reset(
      product
        ? {
            ingredientId: product.ingredientId,
            title: product.title,
            packageSize: String(product.packageSize),
            packageUnit: product.packageUnit,
            priceHuf: product.priceHuf === null ? '' : String(product.priceHuf),
            onSale: product.onSale,
            saleUntil: product.saleUntil ? formatDayMonth(product.saleUntil) : '',
            barcode: product.barcode ?? '',
            notes: product.notes ?? '',
          }
        : empty,
    );
  };

  useImperativeHandle(ref, () => ({
    open: (next) => {
      setProduct(next);
      fill(next);
      sheetRef.current?.present();
    },
  }));

  const save = () =>
    handleSubmit((v) => {
      const saleUntil = v.onSale && v.saleUntil.trim() ? parseDayMonth(v.saleUntil, today) : null;
      if (v.onSale && v.saleUntil.trim() && saleUntil === null) {
        setError('saleUntil', { message: 'Дата как 05.10' });
        return;
      }
      const input = {
        ingredientId: v.ingredientId,
        title: v.title,
        packageSize: v.packageSize,
        packageUnit: v.packageUnit,
        priceHuf: v.priceHuf,
        onSale: v.onSale,
        saleUntil,
        barcode: v.barcode.trim() || null,
        notes: v.notes.trim() || null,
      };
      try {
        if (product) repositories.lidl.update(product.id, input);
        else repositories.lidl.create(input);
        sheetRef.current?.dismiss();
      } catch (e) {
        if (e instanceof DuplicateBarcodeError) setError('barcode', { message: e.message });
        else if (e instanceof z.ZodError)
          setError('barcode', { message: e.issues[0]?.message ?? 'Проверь поля' });
        else throw e;
      }
    })();

  const text = (
    name: 'title' | 'barcode' | 'notes' | 'saleUntil',
    label: string,
    keyboard?: 'number-pad',
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={styles.flex}>
          <TextInput
            mode="outlined"
            label={label}
            accessibilityLabel={label}
            value={field.value}
            onChangeText={field.onChange}
            keyboardType={keyboard}
            error={!!fieldState.error}
            render={sheetInput}
          />
          {fieldState.error ? (
            <HelperText type="error" padding="none">
              {fieldState.error.message}
            </HelperText>
          ) : null}
        </View>
      )}
    />
  );

  return (
    <AppBottomSheet sheetRef={sheetRef}>
      <Text variant="titleLarge" accessibilityRole="header">
        {product ? 'Товар Lidl' : 'Новый товар Lidl'}
      </Text>

      {linked ? (
        <Chip icon="link-variant" onClose={() => setValue('ingredientId', '')} style={styles.start}>
          {linked.name}
        </Chip>
      ) : (
        <>
          <TextInput
            mode="outlined"
            label="Какой это продукт? (поиск)"
            accessibilityLabel="Продукт"
            value={query}
            onChangeText={setQuery}
            left={<TextInput.Icon icon="magnify" />}
            render={sheetInput}
          />
          <View style={styles.chips}>
            {matches.map((m) => (
              <Chip
                key={m.id}
                onPress={() => {
                  setValue('ingredientId', m.id, { shouldValidate: true });
                  setValue('packageUnit', m.unit);
                }}>
                {m.name}
              </Chip>
            ))}
          </View>
          <Controller
            control={control}
            name="ingredientId"
            render={({ fieldState }) =>
              fieldState.error ? (
                <HelperText type="error" padding="none">
                  {fieldState.error.message}
                </HelperText>
              ) : (
                <></>
              )
            }
          />
        </>
      )}

      {text('title', 'Название на ценнике (по-венгерски)')}
      <View style={styles.row}>
        <NumberField control={control} name="packageSize" label="Упаковка" render={sheetInput} />
        <NumberField
          control={control}
          name="priceHuf"
          label="Цена"
          suffix="Ft"
          integer
          render={sheetInput}
        />
      </View>
      <Controller
        control={control}
        name="packageUnit"
        render={({ field }) => (
          <SegmentedButtons
            density="small"
            value={field.value}
            onValueChange={field.onChange}
            buttons={[
              { value: 'g', label: 'граммы' },
              { value: 'ml', label: 'мл' },
              { value: 'pcs', label: 'штуки' },
            ]}
          />
        )}
      />

      <Controller
        control={control}
        name="onSale"
        render={({ field }) => (
          // The whole row toggles, not just the small switch.
          <TouchableRipple
            onPress={() => field.onChange(!field.value)}
            accessibilityRole="switch"
            accessibilityLabel="Скидка"
            accessibilityState={{ checked: field.value }}
            style={styles.switchRow}>
            <View style={styles.switchInner}>
              <Text variant="bodyLarge" style={styles.flex}>
                Скидка
              </Text>
              <Switch value={field.value} onValueChange={field.onChange} />
            </View>
          </TouchableRipple>
        )}
      />
      {onSale ? (
        <>
          {text('saleUntil', 'Скидка до (ДД.ММ), пусто — без срока')}
          <View style={styles.chips}>
            {[3, 7].map((d) => (
              <Chip
                key={d}
                onPress={() => setValue('saleUntil', formatDayMonth(addDays(today, d)))}>
                +{d} дн.
              </Chip>
            ))}
          </View>
        </>
      ) : null}

      {text('barcode', 'Штрихкод (необязательно)', 'number-pad')}
      {text('notes', 'Заметка')}

      <View style={styles.row}>
        {product ? (
          <Button
            textColor={theme.colors.error}
            icon="delete-outline"
            onPress={() => {
              repositories.lidl.remove(product.id);
              sheetRef.current?.dismiss();
            }}>
            Удалить
          </Button>
        ) : null}
        <Button mode="contained" style={styles.flex} onPress={save}>
          Сохранить
        </Button>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  switchRow: { minHeight: 48, justifyContent: 'center', borderRadius: 12 },
  switchInner: { flexDirection: 'row', alignItems: 'center' },
  start: { alignSelf: 'flex-start' },
});
