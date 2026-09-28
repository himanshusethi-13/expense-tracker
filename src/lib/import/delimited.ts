import type { Grid } from "./types";

// Banks use more than commas: HDFC card CSVs separate fields with "~|~".
const CANDIDATE_DELIMITERS = ["~|~", ",", ";", "\t", "|"];

/** Picks the delimiter that splits the most lines into the most consistent number of fields. */
function detectDelimiter(lines: string[]): string {
    const sample = lines.filter((l) => l.trim()).slice(0, 60);
    let best = ",";
    let bestScore = 0;
    for (const delimiter of CANDIDATE_DELIMITERS) {
        const counts = sample.map((l) => l.split(delimiter).length - 1).filter((n) => n > 0);
        if (counts.length === 0) continue;
        // Reward delimiters that appear on many lines, several times per line.
        const score = counts.length * Math.min(...counts.slice(0, 5), 10);
        if (score > bestScore) {
            best = delimiter;
            bestScore = score;
        }
    }
    return best;
}

/** Splits one line, respecting "quoted, fields". */
function splitLine(line: string, delimiter: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else if (ch === '"' && current.trim() === "") {
            inQuotes = true;
            current = "";
        } else if (line.startsWith(delimiter, i)) {
            cells.push(current);
            current = "";
            i += delimiter.length - 1;
        } else {
            current += ch;
        }
    }
    cells.push(current);
    return cells.map((c) => c.trim());
}

/** Joins physical lines that belong to one record because a quoted field contains a line break. */
function logicalLines(text: string): string[] {
    const out: string[] = [];
    let buffer = "";
    for (const line of text.split(/\r?\n/)) {
        buffer = buffer ? `${buffer} ${line}` : line;
        const quotes = (buffer.match(/"/g) ?? []).length;
        if (quotes % 2 === 0) {
            out.push(buffer);
            buffer = "";
        }
    }
    if (buffer) out.push(buffer);
    return out;
}

export function readDelimited(buffer: Buffer): Grid {
    const text = buffer.toString("utf8").replace(/^﻿/, "");
    const lines = logicalLines(text);
    const delimiter = detectDelimiter(lines);
    return lines.map((line) => splitLine(line, delimiter));
}
