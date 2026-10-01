import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { Card, SegmentedButtons, Text } from 'react-native-paper';

import { averageOfLogged, type DayPoint } from '@/domain/history';
import { useT } from '@/i18n';
import { formatDayMonth, formatDecimal, formatInt } from '@/lib/format';
import { spacing, useAppTheme } from '@/theme';

type Props = {
  week: DayPoint[];
  month: DayPoint[];
  today: string;
  targets: { kcalTarget: number; proteinTargetG: number; proteinMinG: number };
  weights: { localDate: string; weightKg: number }[];
};

type Metric = 'kcal' | 'protein';

export function HistoryCharts({ week, month, today, targets, weights }: Props) {
  const theme = useAppTheme();
  const t = useT();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<'7' | '30'>('7');
  const [metric, setMetric] = useState<Metric>('kcal');

  const series = range === '7' ? week : month;
  const target = metric === 'kcal' ? targets.kcalTarget : targets.proteinTargetG;
  const color = metric === 'kcal' ? theme.colors.kcal : theme.colors.protein;
  const values = series.map((p) => (metric === 'kcal' ? p.kcal : p.protein));
  // Tidy axis: round the top up to 500 kcal / 20 g steps (4 sections).
  const step = metric === 'kcal' ? 500 : 20;
  const maxValue = Math.ceil(Math.max(target * 1.3, ...values, 1) / (step * 4)) * step * 4;

  // Chart width = card inner width minus the y-axis labels.
  const chartWidth = width - spacing.lg * 4 - 40;
  const slot = chartWidth / series.length;
  const barWidth = Math.max(4, slot * 0.6);
  const labelEvery = range === '7' ? 1 : 5;

  const data = series.map((p, i) => ({
    value: values[i] ?? 0,
    label:
      i % labelEvery === 0 || i === series.length - 1
        ? formatDayMonth(p.date).slice(0, range === '7' ? 2 : 5)
        : '',
    frontColor: p.date === today ? theme.colors.primaryContainer : color,
  }));

  const avg = averageOfLogged(week, today);

  return (
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.row}>
          <SegmentedButtons
            value={metric}
            onValueChange={(v) => setMetric(v as Metric)}
            density="small"
            style={styles.flex}
            buttons={[
              { value: 'kcal', label: t('history.charts.kcal') },
              { value: 'protein', label: t('history.charts.protein') },
            ]}
          />
          <SegmentedButtons
            value={range}
            onValueChange={(v) => setRange(v as '7' | '30')}
            density="small"
            style={styles.flex}
            buttons={[
              { value: '7', label: t('history.charts.range7') },
              { value: '30', label: t('history.charts.range30') },
            ]}
          />
        </View>

        <View
          accessible
          accessibilityLabel={t('history.charts.a11y', { days: range, target: formatInt(target) })}>
          <BarChart
            data={data}
            width={chartWidth}
            height={160}
            barWidth={barWidth}
            spacing={slot - barWidth}
            initialSpacing={(slot - barWidth) / 2}
            barBorderRadius={3}
            maxValue={maxValue}
            noOfSections={4}
            yAxisLabelWidth={40}
            yAxisTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
            yAxisColor="transparent"
            xAxisColor={theme.colors.outlineVariant}
            rulesColor={theme.colors.outlineVariant}
            showReferenceLine1
            referenceLine1Position={target}
            referenceLine1Config={{
              color: theme.colors.primary,
              dashWidth: 4,
              dashGap: 4,
              thickness: 1.5,
            }}
            disableScroll
            isAnimated
          />
        </View>

        <Text variant="bodyMedium">
          {avg
            ? t('history.charts.average', {
                days: avg.days,
                kcal: formatInt(avg.kcal),
                protein: formatInt(avg.protein),
              })
            : t('history.charts.averageEmpty')}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t(metric === 'kcal' ? 'history.charts.legendKcal' : 'history.charts.legendProtein', {
            target: formatInt(target),
          })}
        </Text>

        {weights.length >= 2 ? (
          <View style={styles.weight}>
            <Text variant="titleSmall">{t('history.charts.weight')}</Text>
            <LineChart
              data={weights
                .slice(-30)
                .map((w) => ({ value: w.weightKg, label: formatDayMonth(w.localDate) }))}
              width={chartWidth}
              height={120}
              color={theme.colors.primary}
              dataPointsColor={theme.colors.primary}
              thickness={2}
              yAxisOffset={Math.floor(Math.min(...weights.map((w) => w.weightKg)) - 2)}
              yAxisLabelWidth={40}
              yAxisTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
              yAxisColor="transparent"
              xAxisColor={theme.colors.outlineVariant}
              rulesColor={theme.colors.outlineVariant}
              noOfSections={3}
              disableScroll
            />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('history.charts.weightChange', {
                from: formatDecimal(weights[0]!.weightKg),
                to: formatDecimal(weights[weights.length - 1]!.weightKg),
              })}
            </Text>
          </View>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  content: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  weight: { gap: spacing.sm, marginTop: spacing.sm },
});
