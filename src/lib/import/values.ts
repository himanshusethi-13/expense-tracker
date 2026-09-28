// Turning statement text into real dates and amounts.

const MONTHS: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const NUMERIC_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/;
const ISO_DATE = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?!\d)/;
// 24 Aug '26 · 17 Sep, 2026 · 28-Sep-2026 · 01JAN26
const DAY_MONTH_YEAR = /^(\d{1,2})[\s/-]*([A-Za-z]{3,9})[\s,/'-]*(\d{4}|\d{2})(?!\d)/;
// June 1, 2026
const MONTH_DAY_YEAR = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})(?!\d)/;

function toYear(y: string): number {
    const n = Number(y);
    return y.length === 2 ? 2000 + n : n;
}

function build(year: number, month: number, day: number): string | null {
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1) return null; // e.g. 31 Feb
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthNumber(name: string): number | null {
    const key = name.toLowerCase();
    return MONTHS[key] ?? MONTHS[key.slice(0, 3)] ?? null;
}

/** Parses the many date styles banks use. Returns YYYY-MM-DD or null. */
export function parseDate(raw: string, dayFirst = true): string | null {
    const s = raw.trim();
    if (!s) return null;

    let m = ISO_DATE.exec(s);
    if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));

    m = NUMERIC_DATE.exec(s);
    if (m) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        return dayFirst ? build(toYear(m[3]), b, a) : build(toYear(m[3]), a, b);
    }

    m = DAY_MONTH_YEAR.exec(s);
    if (m) {
        const month = monthNumber(m[2]);
        return month ? build(toYear(m[3]), month, Number(m[1])) : null;
    }

    m = MONTH_DAY_YEAR.exec(s);
    if (m) {
        const month = monthNumber(m[1]);
        return month ? build(Number(m[3]), month, Number(m[2])) : null;
    }
    return null;
}

/**
 * Decides whether numeric dates are DD/MM (Indian default) or MM/DD.
 * Only switches to month-first when the values prove it (a "day" above 12 in the second position).
 */
export function detectDayFirst(values: string[]): boolean {
    let firstOver12 = 0;
    let secondOver12 = 0;
    for (const v of values) {
        const m = NUMERIC_DATE.exec(v.trim());
        if (!m) continue;
        if (Number(m[1]) > 12) firstOver12++;
        if (Number(m[2]) > 12) secondOver12++;
    }
    return !(secondOver12 > 0 && firstOver12 === 0);
}

export type ParsedAmount = {
    paise: number; // absolute value
    negative: boolean; // written with a minus sign or in brackets
    marker: "credit" | "debit" | null; // "Cr", "Dr", "+", "Credit"… written next to the number
};

/**
 * Parses "1,23,456.78", "₹ 649.00", "1670 Dr.", "7999 Cr.", "+ C 25,068.00", "(500.00)", "-34".
 * Returns null for blanks, dashes and text.
 */
export function parseAmount(raw: string): ParsedAmount | null {
    let s = raw.trim();
    if (!s || /^[-–—]+$/.test(s)) return null;

    let marker: ParsedAmount["marker"] = null;
    const suffix = /\s*\b(cr|credit|dr|debit)\.?\s*$/i.exec(s);
    if (suffix) {
        marker = suffix[1].toLowerCase().startsWith("c") ? "credit" : "debit";
        s = s.slice(0, suffix.index);
    }
    const prefix = /^(cr|dr)\.?\s+/i.exec(s);
    if (!marker && prefix) {
        marker = prefix[1].toLowerCase() === "cr" ? "credit" : "debit";
        s = s.slice(prefix[0].length);
    }
    if (/^\+/.test(s)) {
        marker = marker ?? "credit"; // card statements mark payments/refunds with "+"
        s = s.slice(1);
    }

    let negative = false;
    if (/^\(.*\)$/.test(s.trim())) {
        negative = true;
        s = s.trim().slice(1, -1);
    }
    // Currency: ₹, Rs., INR, and "C" (how one bank's PDF font encodes the ₹ sign).
    s = s.replace(/₹|\bINR\b|\bRs\.?/gi, "").trim().replace(/^C\s*(?=[\d-])/, "");
    if (/^-/.test(s)) {
        negative = true;
        s = s.slice(1);
    }
    s = s.replace(/[,\s]/g, "");
    if (!/^\d+(\.\d+)?$/.test(s)) return null;

    return { paise: Math.round(Number(s) * 100), negative, marker };
}
