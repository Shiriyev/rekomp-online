import { and, asc, eq, isNotNull, lt } from 'drizzle-orm';

import { lidlProductSchema, type LidlProductInput } from '../../domain/schemas';
import { newId } from '../../lib/id';
import { lidlProducts, type LidlProduct } from '../schema';
import type { AppDb } from '../types';

export class DuplicateBarcodeError extends Error {
  constructor() {
    super('errors.duplicateBarcode');
    this.name = 'DuplicateBarcodeError';
  }
}

// Duck-typed, not `instanceof Error`: a native driver's error class can come from another
// JS realm (seen with better-sqlite3 under jest workers), which made this check flaky.
const isUniqueViolation = (e: unknown) => {
  if (typeof e !== 'object' || e === null) return false;
  const { message, cause } = e as { message?: unknown; cause?: unknown };
  return /UNIQUE/.test(`${String(message ?? '')} ${String(cause ?? '')}`);
};

export function createLidlRepo(db: AppDb) {
  const write = <T>(fn: () => T): T => {
    try {
      return fn();
    } catch (e) {
      if (isUniqueViolation(e)) throw new DuplicateBarcodeError();
      throw e;
    }
  };

  return {
    list(): LidlProduct[] {
      return db.select().from(lidlProducts).orderBy(asc(lidlProducts.title)).all();
    },

    create(input: LidlProductInput): LidlProduct {
      const values = lidlProductSchema.parse(input);
      return write(() =>
        db
          .insert(lidlProducts)
          .values({ id: newId(), ...values })
          .returning()
          .get(),
      );
    },

    update(id: string, input: LidlProductInput): LidlProduct {
      const values = lidlProductSchema.parse(input);
      const row = write(() =>
        db.update(lidlProducts).set(values).where(eq(lidlProducts.id, id)).returning().get(),
      );
      if (!row) throw new Error(`Lidl product not found: ${id}`);
      return row;
    },

    remove(id: string): void {
      db.delete(lidlProducts).where(eq(lidlProducts.id, id)).run();
    },

    /** Turns off sales whose last day has passed. Returns how many were cleared. */
    clearExpiredSales(today: string): number {
      return db
        .update(lidlProducts)
        .set({ onSale: false, saleUntil: null })
        .where(
          and(
            eq(lidlProducts.onSale, true),
            isNotNull(lidlProducts.saleUntil),
            lt(lidlProducts.saleUntil, today),
          ),
        )
        .returning({ id: lidlProducts.id })
        .all().length;
    },
  };
}

export type LidlRepo = ReturnType<typeof createLidlRepo>;
