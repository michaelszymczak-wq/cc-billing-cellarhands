import { FruitIntakeRecord } from '../api/client';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Parse "January 2026" into a comparable number (year * 12 + monthIndex).
 */
function monthKeyToOrdinal(key: string): number {
  const [month, yearStr] = key.split(' ');
  const monthIdx = MONTH_NAMES.indexOf(month);
  const year = parseInt(yearStr, 10);
  if (monthIdx === -1 || isNaN(year)) return 0;
  return year * 12 + monthIdx;
}

/**
 * Get the current month ordinal for comparison.
 */
function currentMonthOrdinal(): number {
  const now = new Date();
  return now.getFullYear() * 12 + now.getMonth();
}

/**
 * Calculate remaining balance for a fruit intake record.
 * Sums installment amounts for months that are in the current month or later
 * (i.e., haven't been fully paid yet — current month is still owed).
 */
export function getRemainingBalance(record: FruitIntakeRecord): number {
  const current = currentMonthOrdinal();
  let remaining = 0;
  for (const inst of record.installments) {
    if (monthKeyToOrdinal(inst.month) >= current) {
      remaining += inst.amount;
    }
  }
  return Math.round(remaining * 100) / 100;
}
