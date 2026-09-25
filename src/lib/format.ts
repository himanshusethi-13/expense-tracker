const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

/** Formats a number as a currency value in Indian Rupees. */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}