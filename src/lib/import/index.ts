// The importer's front door: file in, parsed transactions out. Nothing is written to disk here.

import { createHash } from "node:crypto";
import { readDelimited } from "./delimited";
import { detectTable, guessAccountType, isValidMapping } from "./detect";
import { extractRows } from "./extract";
import { readPdf } from "./pdf";
import { readSpreadsheet } from "./spreadsheet";
import type { AccountType, ColumnMapping, Grid, ParsedStatement, SourceKind } from "./types";

export { PdfNoTextError, PdfPasswordError } from "./pdf";
export type * from "./types";

export class StatementFormatError extends Error {}

type FileKind = "pdf" | "spreadsheet" | "delimited";

/** Decides the format from the file's first bytes, not just its name (banks mislabel .xls files). */
function fileKind(buffer: Buffer, fileName: string): FileKind {
    const head = buffer.subarray(0, 8);
    if (head.toString("latin1").startsWith("%PDF")) return "pdf";
    if (head[0] === 0x50 && head[1] === 0x4b) return "spreadsheet"; // .xlsx (zip)
    if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return "spreadsheet"; // old .xls
    const start = buffer.subarray(0, 512).toString("utf8").trimStart().toLowerCase();
    if (start.startsWith("<")) return "spreadsheet"; // HTML table saved as .xls
    if (/\.(xls|xlsx)$/i.test(fileName)) return "spreadsheet";
    return "delimited";
}

function signatureOf(source: SourceKind, headers: string[]): string {
    const labels = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
    return createHash("sha256").update(`${source}|${labels.join("|")}`).digest("hex").slice(0, 32);
}

export type ParseOptions = {
    buffer: Buffer;
    fileName: string;
    password?: string;
    account: string;
    accountType: AccountType;
    /** A mapping the user corrected in the preview; wins over everything else. */
    mapping?: ColumnMapping | null;
    /** Looks up a mapping remembered from an earlier import of the same layout. */
    rememberedMapping?: (signature: string) => ColumnMapping | null;
};

export type ParseResult = ParsedStatement & { usedRememberedMapping: boolean };

export async function parseStatement(options: ParseOptions): Promise<ParseResult> {
    const kind = fileKind(options.buffer, options.fileName);
    const source: SourceKind = kind === "pdf" ? "pdf" : "sheet";

    let grids: Grid[];
    if (kind === "pdf") grids = [await readPdf(options.buffer, options.password)];
    else if (kind === "spreadsheet") grids = readSpreadsheet(options.buffer);
    else grids = [readDelimited(options.buffer)];

    let best: ParseResult | null = null;
    for (const grid of grids) {
        const detected = detectTable(grid);
        if (!detected) continue;

        const headers = grid[detected.headerRow].map((h, i) => h || `Column ${i + 1}`);
        const signature = signatureOf(source, grid[detected.headerRow]);
        const remembered = options.rememberedMapping?.(signature) ?? null;

        let mapping = detected.mapping;
        let usedRememberedMapping = false;
        if (options.mapping && isValidMapping(options.mapping, headers.length)) {
            mapping = options.mapping;
        } else if (remembered && isValidMapping(remembered, headers.length)) {
            mapping = remembered;
            usedRememberedMapping = true;
        }

        const { rows, warnings } = extractRows(grid, detected.headerRow, mapping, options.accountType, options.account);
        if (!best || rows.length > best.rows.length) {
            best = {
                source,
                headers,
                mapping,
                signature,
                rows,
                warnings,
                usedRememberedMapping,
                suggestedAccountType: guessAccountType(grid, detected.headerRow),
            };
        }
    }

    if (!best) {
        throw new StatementFormatError(
            "Couldn't find a transaction table in this file. It needs a header row with a date column and an amount (or withdrawal/deposit) column.",
        );
    }
    if (best.rows.length === 0) best.warnings.push("No transactions were found with these columns. Check the column choices below.");
    return best;
}
