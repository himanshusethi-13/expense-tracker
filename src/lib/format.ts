const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Amounts are stored in paise (whole numbers) to avoid rounding errors. */
export function formatAmount(paise: number): string {
  return currencyFormatter.format(paise / 100);
}

/** Formats a date in the required format. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/** Formats a month in the required format. */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Todays's dateb as YYYY-MM-DD in local time */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The current month as YYYY-MM in local time */
export function currentMonth(): string {
  return todayISO().slice(0, 7);
}