import assert from 'node:assert/strict';
import { test } from 'node:test';

import { config } from '../../pipeline.config.ts';
import { latestLink } from './usda.ts';

test('latestLink picks the newest matching file name', () => {
  const html = `
    <a href="/fdc-datasets/FoodData_Central_foundation_food_csv_2025-12-18.zip">
    <a href="/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip">
    <a href="/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip">
    <a href="/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip">`;
  assert.equal(
    latestLink(html, config.usda.datasets.foundation),
    'FoodData_Central_foundation_food_csv_2026-04-30.zip',
  );
  assert.equal(
    latestLink(html, config.usda.datasets.srLegacy),
    'FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  );
  assert.equal(latestLink('<html></html>', config.usda.datasets.foundation), null);
});
