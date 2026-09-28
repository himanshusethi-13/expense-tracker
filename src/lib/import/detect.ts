// Finds the transaction table inside a statement and works out which column is which.

import type { ColumnMapping, Grid } from "./types";
import { detectDayFirst, parseAmount, parseDate } from "./values";

type Role = "date" | "description" | "debit" | "credit" | "amount" | "drCr" | "balance";

function clean(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9&/]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * What a header label means. Order matters: "Debit / Credit" is a Dr/Cr indicator,
 * not a debit column, and "Withdrawal Amount (INR)" is a debit column, not "amount".
 */
function roleOf(label: string): { role: Role; rank: number } | null {
    const l = clean(label);
    if (!l) return null;
    const words = l.split(/[\s/&]+/);
    const has = (w: string) => words.includes(w);

    if (/\b(dr ?\/ ?cr|cr ?\/ ?dr|debit ?\/ ?credit|credit ?\/ ?debit)\b/.test(l)) return { role: "drCr", rank: 2 };
    if (has("balance") || l === "bal") return { role: "balance", rank: 1 };
    if (has("withdrawal") || has("withdrawals") || has("debits") || l.startsWith("debit") || has("dr") || l === "paid out")
        return { role: "debit", rank: 1 };
    if (has("deposit") || has("deposits") || has("credits") || l.startsWith("credit") || has("cr") || l === "paid in")
        return { role: "credit", rank: 1 };
    if (has("date") || has("dt") || has("timestamp")) {
        // Prefer the transaction date over the value/posting date.
        const secondary = has("value") || has("posting") || has("booked");
        return { role: "date", rank: secondary ? 1 : 2 };
    }
    if (has("narration") || has("description") || has("particulars") || has("details") || has("remarks") || has("merchant"))
        return { role: "description", rank: has("narration") || has("description") || has("particulars") ? 2 : 1 };
    if (has("amount") || has("amt") || l === "inr") return { role: "amount", rank: 1 };
    return null;
}

function rolesInRow(row: string[]): Partial<Record<Role, { col: number; rank: number }>> {
    const found: Partial<Record<Role, { col: number; rank: number }>> = {};
    row.forEach((cell, col) => {
        const r = roleOf(cell);
        if (!r) return;
        const current = found[r.role];
        if (!current || r.rank > current.rank) found[r.role] = { col, rank: r.rank };
    });
    return found;
}

function isHeaderLike(roles: ReturnType<typeof rolesInRow>): boolean {
    return Boolean(roles.date && (roles.amount || roles.debit || roles.credit));
}

/**
 * True if the column mostly holds Dr/Cr style values (validates a guessed indicator column).
 * "Mostly", because other tables further down the sheet can reuse the same column.
 */
function looksLikeDrCr(values: string[]): boolean {
    const filled = values.map((v) => v.trim().toLowerCase().replace(/\.$/, "")).filter(Boolean);
    const valid = filled.filter((v) => ["dr", "cr", "debit", "credit", "d", "c"].includes(v)).length;
    return valid > 0 && valid >= filled.length * 0.8;
}

export type Detection = { headerRow: number; mapping: ColumnMapping };

/** Scans the top of a grid for the header row and maps its columns. */
export function detectTable(grid: Grid): Detection | null {
    const limit = Math.min(grid.length, 120);
    for (let r = 0; r < limit; r++) {
        const roles = rolesInRow(grid[r]);
        if (!isHeaderLike(roles)) continue;

        const dateCol = roles.date!.col;
        const body = grid.slice(r + 1, r + 400);
        const dateValues = body.map((row) => row[dateCol] ?? "").filter((v) => v.trim());
        const dayFirst = detectDayFirst(dateValues);
        const dated = dateValues.filter((v) => parseDate(v, dayFirst)).length;
        if (dated === 0) continue; // a summary table that happens to say "date" and "amount"

        const drCrCol = roles.drCr?.col ?? null;
        const amountCol = roles.amount?.col;
        const transactionRows = body.filter(
            (row) => parseDate(row[dateCol] ?? "", dayFirst) && (amountCol === undefined || parseAmount(row[amountCol] ?? "")),
        );
        const drCrValid = drCrCol !== null && looksLikeDrCr(transactionRows.map((row) => row[drCrCol] ?? ""));

        let amount = roles.amount?.col ?? null;
        let debit = roles.debit?.col ?? null;
        let credit = roles.credit?.col ?? null;
        // A lone "Credit" or "Debit" column next to an Amount column is really a Dr/Cr flag.
        if (amount !== null && (debit === null) !== (credit === null)) {
            debit = null;
            credit = null;
        }
        if (amount === null && (debit === null || credit === null)) {
            amount = debit ?? credit;
            debit = null;
            credit = null;
        }
        if (debit !== null && credit !== null) amount = null;

        const description = roles.description?.col ?? pickDescriptionColumn(body, [dateCol, amount, debit, credit]);
        if (description === null) continue;

        return {
            headerRow: r,
            mapping: {
                date: dateCol,
                description,
                amount,
                debit,
                credit,
                drCr: drCrValid ? drCrCol : null,
                balance: roles.balance?.col ?? null,
                dayFirst,
            },
        };
    }
    return null;
}

/** When no header says "description", use the column with the longest text. */
function pickDescriptionColumn(body: Grid, exclude: (number | null)[]): number | null {
    const totals = new Map<number, number>();
    for (const row of body.slice(0, 50)) {
        row.forEach((cell, col) => {
            if (exclude.includes(col) || parseAmount(cell)) return;
            totals.set(col, (totals.get(col) ?? 0) + cell.length);
        });
    }
    let best: number | null = null;
    for (const [col, total] of totals) if (best === null || total > (totals.get(best) ?? 0)) best = col;
    return best;
}

/** Checks a mapping the user edited in the preview: every column must exist in the header. */
export function isValidMapping(m: ColumnMapping, columnCount: number): boolean {
    const inRange = (c: number | null) => c === null || (Number.isInteger(c) && c >= 0 && c < columnCount);
    const cols = [m.date, m.description, m.amount, m.debit, m.credit, m.drCr, m.balance];
    if (!cols.every(inRange) || m.date === null || m.description === null) return false;
    return m.amount !== null || (m.debit !== null && m.credit !== null);
}

const CARD_WORDS = /credit\s*card|card\s*(no|number|holder)|minimum\s*(amount\s*)?due|total\s*amount\s*due|payment\s*due\s*date|credit\s*limit/i;
const BANK_WORDS = /savings|current\s*a\/?c|statement\s*of\s*accounts?|account\s*(no|number|statement|branch)|ifsc|branch/i;

/** Reads the text above the transaction table to tell a card statement from a bank statement. */
export function guessAccountType(grid: Grid, headerRow: number): "bank" | "credit_card" | null {
    const text = grid.slice(0, headerRow).map((row) => row.join(" ")).join(" ");
    if (CARD_WORDS.test(text)) return "credit_card"; // checked first: card statements also mention an "account number"
    if (BANK_WORDS.test(text)) return "bank";
    return null;
}
