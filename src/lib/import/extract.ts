// Walks the rows under the header and turns each transaction line into a ParsedRow.

import { createHash } from "node:crypto";
import { classify } from "./classify";
import type { AccountType, ColumnMapping, Grid, ParsedRow } from "./types";
import { parseAmount, parseDate } from "./values";

// This many consecutive empty rows after the table has started means the table has ended.
const END_OF_TABLE_BLANK_ROWS = 5;

type Direction = "debit" | "credit";

function cell(row: string[], col: number | null): string {
    return col === null ? "" : (row[col] ?? "").trim();
}

function directionFromWord(value: string): Direction | null {
    const v = value.trim().toLowerCase().replace(/\.$/, "");
    if (v === "cr" || v === "credit" || v === "c") return "credit";
    if (v === "dr" || v === "debit" || v === "d") return "debit";
    return null;
}

/**
 * Many statements only mark one side: HDFC cards write "Cr" next to credits and leave debits blank,
 * others put "+" before credits. If every marker in the file points the same way, an unmarked row
 * must be the other way. Returns that direction, or null if the file doesn't tell us.
 */
function unmarkedDirection(grid: Grid, headerRow: number, m: ColumnMapping): Direction | null {
    if (m.amount === null) return null;
    const seen = new Set<Direction>();
    for (const row of grid.slice(headerRow + 1)) {
        if (!parseDate(cell(row, m.date), m.dayFirst)) continue;
        const flag = directionFromWord(cell(row, m.drCr));
        if (flag) seen.add(flag);
        const marker = parseAmount(cell(row, m.amount))?.marker;
        if (marker) seen.add(marker);
    }
    if (seen.size !== 1) return null;
    return seen.has("credit") ? "debit" : "credit";
}

/** Reads the amount and whether money went out (debit) or came in (credit). */
function readMoney(
    row: string[],
    m: ColumnMapping,
    accountType: AccountType,
    unmarked: Direction | null,
): { paise: number; direction: Direction } | "ambiguous" | null {
    if (m.debit !== null && m.credit !== null) {
        const out = parseAmount(cell(row, m.debit));
        const inn = parseAmount(cell(row, m.credit));
        const outPaise = out?.paise ?? 0;
        const inPaise = inn?.paise ?? 0;
        if (outPaise > 0 && inPaise > 0) return "ambiguous";
        if (outPaise > 0) return { paise: outPaise, direction: "debit" };
        if (inPaise > 0) return { paise: inPaise, direction: "credit" };
        return null;
    }

    const a = parseAmount(cell(row, m.amount));
    if (!a || a.paise === 0) return null;
    const flag = directionFromWord(cell(row, m.drCr));
    if (flag) return { paise: a.paise, direction: flag };
    if (a.marker) return { paise: a.paise, direction: a.marker };
    if (unmarked && !a.negative) return { paise: a.paise, direction: unmarked };
    // No marker: banks write withdrawals as negative; card statements write refunds/payments as negative.
    if (accountType === "bank") return { paise: a.paise, direction: a.negative ? "debit" : "credit" };
    return { paise: a.paise, direction: a.negative ? "credit" : "debit" };
}

function isBlank(row: string[], m: ColumnMapping): boolean {
    return [m.date, m.description, m.amount, m.debit, m.credit].every((c) => cell(row, c) === "");
}

/**
 * A stable ID for a transaction, so the same transaction in an overlapping statement is recognised.
 * The description is left out on purpose: banks word it differently in their PDF, Excel and CSV
 * versions of the same statement. Several identical payments on one day are told apart by `occurrence`.
 */
function makeFingerprint(account: string, date: string, paise: number, direction: Direction, occurrence: number): string {
    const key = [account.trim().toLowerCase(), date, paise, direction, occurrence].join("|");
    return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

export function extractRows(
    grid: Grid,
    headerRow: number,
    m: ColumnMapping,
    accountType: AccountType,
    account: string,
): { rows: ParsedRow[]; warnings: string[] } {
    const rows: ParsedRow[] = [];
    const warnings: string[] = [];
    let blankRun = 0;
    let ambiguous = 0;
    const unmarked = unmarkedDirection(grid, headerRow, m);

    for (let r = headerRow + 1; r < grid.length; r++) {
        const row = grid[r];
        if (isBlank(row, m)) {
            if (rows.length > 0 && ++blankRun >= END_OF_TABLE_BLANK_ROWS) break;
            continue;
        }
        blankRun = 0;

        const date = parseDate(cell(row, m.date), m.dayFirst);
        const money = date ? readMoney(row, m, accountType, unmarked) : null;

        if (money === "ambiguous") {
            ambiguous++;
            continue;
        }
        if (!date || !money) {
            // A wrapped description: text on its own line right after a transaction.
            const extra = cell(row, m.description);
            const last = rows[rows.length - 1];
            if (last && extra && !cell(row, m.date) && !cell(row, m.amount ?? m.debit) && !cell(row, m.credit)) {
                last.description = `${last.description} ${extra}`.trim();
            }
            continue;
        }

        const description = cell(row, m.description).replace(/\s+/g, " ") || "(no description)";
        const guess = classify(description, money.direction, accountType);
        rows.push({
            index: rows.length,
            date,
            description,
            amountPaise: money.paise,
            direction: money.direction,
            kind: guess.kind,
            category: guess.category,
            fingerprint: "", // filled in below
        });
    }

    const seen = new Map<string, number>(); // identical payments on the same day (e.g. two ₹20 chai payments)
    for (const row of rows) {
        const base = [row.date, row.amountPaise, row.direction].join("|");
        const occurrence = seen.get(base) ?? 0;
        seen.set(base, occurrence + 1);
        row.fingerprint = makeFingerprint(account, row.date, row.amountPaise, row.direction, occurrence);
    }

    if (ambiguous > 0) warnings.push(`${ambiguous} row(s) had both a withdrawal and a deposit and were skipped.`);
    return { rows, warnings };
}
