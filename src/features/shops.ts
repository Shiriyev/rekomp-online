import type { Shop } from '@/domain/types';

/** The chains as they write themselves on the shopfront, so they are recognisable at a glance. */
export const SHOP_LABELS: Record<Shop, string> = {
  lidl: 'Lidl',
  spar: 'SPAR',
  tesco: 'Tesco',
  aldi: 'ALDI',
};
