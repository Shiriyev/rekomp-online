/** A sale counts while its last day (inclusive, local YYYY-MM-DD) has not passed. */
export function isSaleActive(
  product: { onSale: boolean; saleUntil: string | null },
  today: string,
): boolean {
  if (!product.onSale) return false;
  return product.saleUntil === null || product.saleUntil >= today;
}
