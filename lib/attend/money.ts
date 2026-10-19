/** Amounts are stored in cents. */
export function fmtMoney(cents: number | null | undefined, currency: string, intl: string): string {
  if (cents === null || cents === undefined) return "—";
  try {
    return new Intl.NumberFormat(intl, { style: "currency", currency, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
