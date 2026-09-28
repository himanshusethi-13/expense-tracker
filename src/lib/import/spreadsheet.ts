import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.full";
import type { Grid } from "./types";

// Older .xls files can store text in legacy Windows code pages; this lets SheetJS decode them.
// (The CommonJS build loads these tables itself and has no set_cptable.)
if (typeof XLSX.set_cptable === "function") XLSX.set_cptable(cptable);

function pad(n: number): string {
    return String(n).padStart(2, "0");
}

/** Converts one cell to text. Real Excel dates become YYYY-MM-DD so no locale guessing is needed. */
function cellToText(cell: XLSX.CellObject | undefined): string {
    if (!cell || cell.v === undefined || cell.v === null) return "";
    if (cell.t === "n" && typeof cell.v === "number") {
        if (cell.z && XLSX.SSF.is_date(cell.z)) {
            const d = XLSX.SSF.parse_date_code(cell.v);
            if (d) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
        }
        return String(cell.v); // raw number, no thousands separators
    }
    if (cell.t === "d" && cell.v instanceof Date) {
        const d = cell.v;
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    return String(cell.v).replace(/\s+/g, " ").trim();
}

function sheetToGrid(sheet: XLSX.WorkSheet): Grid {
    const ref = sheet["!ref"];
    if (!ref) return [];
    const range = XLSX.utils.decode_range(ref);
    const grid: Grid = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
        const row: string[] = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
            row.push(cellToText(sheet[XLSX.utils.encode_cell({ r, c })]));
        }
        grid.push(row);
    }
    return grid;
}

/**
 * Reads .xls / .xlsx (and HTML tables saved as .xls, which some banks send).
 * Returns every sheet; the caller picks the one that contains the transactions.
 */
export function readSpreadsheet(buffer: Buffer): Grid[] {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, dense: false });
    return workbook.SheetNames.map((name) => sheetToGrid(workbook.Sheets[name]));
}
