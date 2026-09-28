// Shared shapes for the statement importer.

import type { Category, Kind } from "@/types";

/** Every reader (CSV, Excel, PDF) turns its file into this: rows of text cells. */
export type Grid = string[][];

export type SourceKind = "sheet" | "pdf";

export type AccountType = "bank" | "credit_card";

/**
 * Which column holds what. Column numbers are positions in the header row.
 * Either `amount` (one column, direction from a marker / sign / Dr-Cr column)
 * or `debit` + `credit` (two columns) must be set.
 */
export type ColumnMapping = {
    date: number;
    description: number;
    amount: number | null;
    debit: number | null;
    credit: number | null;
    drCr: number | null;
    balance: number | null;
    dayFirst: boolean; // 04/07/2026 = 4 July (true) or April 7 (false)
};

/** One transaction read from the statement, before it is saved. */
export type ParsedRow = {
    index: number; // position in the statement, used to match edits from the preview
    date: string; // YYYY-MM-DD
    description: string;
    amountPaise: number; // always positive
    direction: "debit" | "credit"; // money out / money in, as the statement says
    kind: Kind; // suggested type, the user can change it
    category: Category; // suggested category, the user can change it
    fingerprint: string;
};

export type ParsedStatement = {
    source: SourceKind;
    headers: string[];
    mapping: ColumnMapping;
    signature: string; // identifies this bank's layout, used to remember the mapping
    rows: ParsedRow[];
    warnings: string[];
    /** What the file itself suggests (card vs bank), from words above the table; null if unclear. */
    suggestedAccountType: AccountType | null;
};
