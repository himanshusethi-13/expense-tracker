// Rebuilds the transaction table from a text-based PDF using where each word sits on the page.

import type { Grid } from "./types";
import { parseAmount, parseDate } from "./values";

type Item = { x: number; right: number; y: number; h: number; text: string };
type Line = { y: number; h: number; items: Item[] };
type Column = { left: number; right: number; label: string };

export class PdfPasswordError extends Error {
    constructor(public reason: "required" | "incorrect") {
        super(reason === "required" ? "This PDF is password-protected." : "That password is not correct.");
    }
}

export class PdfNoTextError extends Error {
    constructor() {
        super(
            "This PDF has no readable text (it's a scanned image), so it can't be imported. Use the CSV or Excel version of this statement instead.",
        );
    }
}

async function loadPages(buffer: Buffer, password?: string): Promise<Line[][]> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        password: password || undefined,
        disableFontFace: true,
        useSystemFonts: false,
        verbosity: 0,
    });

    let doc;
    try {
        doc = await task.promise;
    } catch (error) {
        const e = error as { name?: string; code?: number };
        if (e?.name === "PasswordException") throw new PdfPasswordError(e.code === 2 ? "incorrect" : "required");
        throw error;
    }

    try {
        const pages: Line[][] = [];
        for (let p = 1; p <= doc.numPages; p++) {
            const page = await doc.getPage(p);
            const pageHeight = page.getViewport({ scale: 1 }).height;
            const content = await page.getTextContent();
            const items: Item[] = [];
            for (const raw of content.items) {
                if (!("str" in raw) || !raw.str.trim()) continue;
                const [, , , scaleY, x, y] = raw.transform as number[];
                const h = Math.abs(raw.height || scaleY) || 8;
                items.push({ x, right: x + raw.width, y: pageHeight - y, h, text: raw.str.trim() });
            }
            pages.push(groupIntoLines(items));
        }
        return pages;
    } finally {
        // Frees the parsed document (destroying the loading task works in pdf.js 5 and 6).
        await task.destroy();
    }
}

/** Words whose vertical positions are within about half a text height of each other form one line. */
function groupIntoLines(items: Item[]): Line[] {
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    const lines: Line[] = [];
    for (const item of sorted) {
        const line = lines[lines.length - 1];
        if (line && Math.abs(item.y - line.y) <= Math.max(2, item.h * 0.45)) line.items.push(item);
        else lines.push({ y: item.y, h: item.h, items: [item] });
    }
    for (const line of lines) line.items.sort((a, b) => a.x - b.x);
    return lines;
}

const HEADER_WORD = /\b(date|dt|narration|description|particulars|details|remarks|withdrawal|deposit|debit|credit|amount|amt|balance)\b|\((inr|rs\.?|₹)\)/i;

function lineText(line: Line): string {
    return line.items.map((i) => i.text).join(" ");
}

type Header = { columns: Column[]; firstIndex: number; lastIndex: number };

/** Finds every table header on a page. A header may be split over 2–3 stacked lines ("Withdrawal" above "Amount (INR)"). */
function findHeaders(lines: Line[]): Header[] {
    const headers: Header[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (!HEADER_WORD.test(lineText(lines[i]))) continue;
        const block = [lines[i]];
        for (let j = i + 1; j < lines.length; j++) {
            const gap = lines[j].y - block[block.length - 1].y;
            if (gap > lines[i].h * 1.8 || !HEADER_WORD.test(lineText(lines[j]))) break;
            block.push(lines[j]);
        }
        const text = block.map(lineText).join(" ").toLowerCase();
        const hasDate = /\bdate\b|\bdt\b/.test(text);
        const hasMoney = /\b(amount|amt|withdrawal|deposit|debit|credit)\b/.test(text);
        // Header lines are short labels, not sentences that happen to mention "date" and "amount".
        const isParagraph = block.some((l) => l.items.some((it) => it.text.length > 40));
        if (!hasDate || !hasMoney || isParagraph) continue;

        const columns = buildColumns(block);
        if (columns.length >= 3) {
            headers.push({ columns, firstIndex: i, lastIndex: i + block.length - 1 });
            i += block.length - 1;
        }
    }
    return headers;
}

function sameColumns(a: Column[], b: Column[]): boolean {
    const key = (cols: Column[]) => cols.map((c) => c.label.toLowerCase().replace(/[^a-z]/g, "")).join("|");
    return key(a) === key(b);
}

/** Same line + tiny gap = one label ("Transaction" "Details"); stacked + overlapping = one column. */
function buildColumns(block: Line[]): Column[] {
    const labels: Column[] = [];
    for (const line of block) {
        let previous: Column | null = null;
        for (const it of line.items) {
            if (previous && it.x - previous.right < line.h) {
                previous.right = it.right;
                previous.label = `${previous.label} ${it.text}`;
            } else {
                previous = { left: it.x, right: it.right, label: it.text };
                labels.push(previous);
            }
        }
    }
    const columns: Column[] = [];
    for (const label of labels.sort((a, b) => a.left - b.left)) {
        const stacked = columns.find((c) => label.left < c.right && label.right > c.left);
        if (stacked) {
            stacked.left = Math.min(stacked.left, label.left);
            stacked.right = Math.max(stacked.right, label.right);
            stacked.label = `${stacked.label} ${label.label}`;
        } else {
            columns.push({ ...label });
        }
    }
    return columns.sort((a, b) => a.left - b.left);
}

/** Puts a word in the column it overlaps most, or else the nearest one. */
function columnFor(item: Item, columns: Column[]): number {
    let best = 0;
    let bestScore = -Infinity;
    columns.forEach((c, i) => {
        const overlap = Math.min(item.right, c.right) - Math.max(item.x, c.left);
        const score = overlap > 0 ? overlap : -Math.min(Math.abs(item.x - c.right), Math.abs(item.right - c.left));
        if (score > bestScore) {
            bestScore = score;
            best = i;
        }
    });
    return best;
}

function toCells(line: Line, columns: Column[]): string[] {
    const cells = columns.map(() => "");
    for (const item of line.items) {
        const c = columnFor(item, columns);
        cells[c] = cells[c] ? `${cells[c]} ${item.text}` : item.text;
    }
    return cells;
}

function appendCells(target: string[], extra: string[], before: boolean) {
    extra.forEach((text, i) => {
        if (!text) return;
        target[i] = !target[i] ? text : before ? `${text} ${target[i]}` : `${target[i]} ${text}`;
    });
}

function dateAndMoneyColumns(cols: Column[]) {
    return {
        dateCols: cols.flatMap((c, i) => (/\bdate\b|\bdt\b/i.test(c.label) ? [i] : [])),
        moneyCols: cols.flatMap((c, i) => (/amount|amt|withdrawal|deposit|debit|credit/i.test(c.label) ? [i] : [])),
    };
}

/** A transaction line has a date in a date column and an amount in a money column. */
function anchorFlags(cells: string[][], cols: Column[]): boolean[] {
    const { dateCols, moneyCols } = dateAndMoneyColumns(cols);
    return cells.map((c) => dateCols.some((d) => parseDate(c[d])) && moneyCols.some((m) => parseAmount(c[m])));
}

/**
 * Reads a text PDF into a grid: the text above the table, the header row, then one row per transaction.
 * A transaction starts on a line that has a date and an amount; wrapped description
 * lines just above or below it are merged into the same row. Stops when a different
 * table (loan summary, rewards…) begins.
 */
export async function readPdf(buffer: Buffer, password?: string): Promise<Grid> {
    const pages = await loadPages(buffer, password);
    if (pages.every((lines) => lines.length === 0)) throw new PdfNoTextError();

    let columns: Column[] | null = null;
    let finished = false;
    const rows: string[][] = [];
    const preamble: string[][] = []; // text above the table (e.g. "Credit Card Statement"), one line per row

    for (const lines of pages) {
        if (finished) break;
        const headers = findHeaders(lines);
        let start = 0;
        let end = lines.length;

        if (!columns) {
            // Several tables can share a page (account summary, then transactions): take the one with the most transactions.
            let best: { header: Header; anchors: number } | null = null;
            headers.forEach((h, n) => {
                const stop = headers[n + 1]?.firstIndex ?? lines.length;
                const cells = lines.slice(h.lastIndex + 1, stop).map((l) => toCells(l, h.columns));
                const anchors = anchorFlags(cells, h.columns).filter(Boolean).length;
                if (anchors > 0 && (!best || anchors > best.anchors)) best = { header: h, anchors };
            });
            if (!best) continue;
            const chosen: Header = (best as { header: Header }).header;
            for (const line of lines.slice(0, chosen.firstIndex)) preamble.push([lineText(line)]);
            columns = chosen.columns;
            start = chosen.lastIndex + 1;
            const following = headers.find((h) => h.firstIndex > chosen.lastIndex);
            if (following) {
                end = following.firstIndex;
                finished = true;
            }
        } else {
            // Later pages: a repeat of our header is skipped; any other table ends the statement.
            for (const h of headers) {
                if (sameColumns(h.columns, columns)) {
                    start = Math.max(start, h.lastIndex + 1);
                } else {
                    end = h.firstIndex;
                    finished = true;
                    break;
                }
            }
        }

        const cols: Column[] = columns;
        const body = lines.slice(start, end);
        const cells = body.map((line) => toCells(line, cols));
        const isAnchor = anchorFlags(cells, cols);

        const rowAt = new Map<number, string[]>(); // line index -> its row
        let current: { cells: string[]; lastY: number } | null = null;
        const above: { line: number; target: number }[] = [];

        for (let i = 0; i < body.length; i++) {
            if (isAnchor[i]) {
                current = { cells: cells[i], lastY: body[i].y };
                rows.push(current.cells);
                rowAt.set(i, current.cells);
                continue;
            }
            const next = isAnchor.findIndex((a, k) => a && k > i);
            const toNext = next > -1 ? body[next].y - body[i].y : Infinity;
            const fromCurrent = current ? body[i].y - current.lastY : Infinity;
            // Text just above the next date line belongs to that row (descriptions are vertically centred).
            if (toNext <= body[i].h * 1.25 && toNext < fromCurrent) {
                above.push({ line: i, target: next });
            } else if (current && fromCurrent <= body[i].h * 1.8) {
                // Otherwise it continues the row above, if it sits right under it.
                appendCells(current.cells, cells[i], false);
                current.lastY = body[i].y;
            }
        }
        // Prepend in reverse so several "above" lines keep their order.
        for (const { line, target } of above.reverse()) {
            const row = rowAt.get(target);
            if (row) appendCells(row, cells[line], true);
        }
    }

    if (!columns) return [];
    return [...preamble, (columns as Column[]).map((c) => c.label), ...rows];
}
