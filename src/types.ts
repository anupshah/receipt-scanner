// ============================================================
// TYPES
// ============================================================

export interface ReceiptData {
  vendor: string | null;
  date: string | null;           // ISO 8601 date string YYYY-MM-DD
  total: number | null;          // Total amount paid (inc. VAT)
  subtotal: number | null;       // Amount before VAT
  vatAmount: number | null;      // VAT amount in GBP
  vatRate: VatRate | null;       // Standard UK VAT rates
  vatNumber: string | null;      // Supplier VAT registration number
  category: ExpenseCategory | null;
  rawText: string;
}

export type VatRate = 0 | 0.05 | 0.20;

export type ExpenseCategory =
  | 'travel'
  | 'meals'
  | 'accommodation'
  | 'office'
  | 'equipment'
  | 'software'
  | 'other';

export const VAT_RATE_LABELS: Record<VatRate, string> = {
  0: '0% (Exempt / Zero-rated)',
  0.05: '5% (Reduced rate)',
  0.20: '20% (Standard rate)',
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'travel', 'meals', 'accommodation', 'office', 'equipment', 'software', 'other',
];

