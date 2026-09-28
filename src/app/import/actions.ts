"use server";

//Server Actions for statement import. The uploaded file is only read in memory to parse it;
//it is never written to disk. Only the resulting transactions are saved.

import { revalidatePath } from "next/cache";
import {
    parseStatement,
    PdfNoTextError,
    PdfPasswordError,
    StatementFormatError,
    type AccountType,
    type ColumnMapping,
    type ParsedRow,
    type ParseResult,
} from "@/lib/import";
import { deleteImport, existingFingerprints, findLayout, saveImport } from "@/lib/imports";
import { CATEGORIES, KINDS, type Category, type Kind, type SpendingCategory } from "@/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROW_EDITS = 5000;

export type PreviewRow = Omit<ParsedRow, "fingerprint"> & { duplicate: boolean };

export type PreviewResult =
    | {
          ok: true;
          fileName: string;
          headers: string[];
          mapping: ColumnMapping;
          usedRememberedMapping: boolean;
          accountType: AccountType; // the type these rows were read as
          suggestedAccountType: AccountType | null; // what the file itself looks like
          rows: PreviewRow[];
          warnings: string[];
      }
    | { ok: false; error: string; needsPassword?: boolean };

export type CommitResult = { ok: true; inserted: number; skipped: number } | { ok: false; error: string };

type CommonInput = {
    file: File;
    buffer: Buffer;
    account: string;
    accountType: AccountType;
    password: string;
    mapping: ColumnMapping | null;
};

//Validate on the server - never trust what the browser sends.
async function readCommonInput(formData: FormData): Promise<CommonInput | string> {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return "Please choose a statement file.";
    if (file.size > MAX_FILE_BYTES) return "That file is larger than 10 MB. Statements are usually much smaller; check you picked the right file.";
    if (!/\.(csv|txt|xls|xlsx|pdf)$/i.test(file.name)) return "Please choose a CSV, Excel (.xls/.xlsx) or PDF statement.";

    const account = String(formData.get("account") ?? "").trim();
    if (!account || account.length > 100) return "Please enter an account name (up to 100 characters).";

    const accountType = String(formData.get("accountType") ?? "");
    if (accountType !== "bank" && accountType !== "credit_card") return "Please choose whether this is a bank account or a credit card.";

    const password = String(formData.get("password") ?? "");
    if (password.length > 200) return "That password is too long.";

    const mappingText = formData.get("mapping");
    let mapping: ColumnMapping | null = null;
    if (typeof mappingText === "string" && mappingText) {
        mapping = parseMapping(mappingText);
        if (!mapping) return "The column choices are not valid. Please pick them again.";
    }

    return { file, buffer: Buffer.from(await file.arrayBuffer()), account, accountType, password, mapping };
}

/** Accepts only the exact mapping shape: known keys, whole numbers or null, and a boolean. */
function parseMapping(text: string): ColumnMapping | null {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return null;
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    const columnKeys = ["date", "description", "amount", "debit", "credit", "drCr", "balance"] as const;
    const allowed = new Set<string>([...columnKeys, "dayFirst"]);
    if (Object.keys(obj).some((k) => !allowed.has(k))) return null;

    const col = (v: unknown) => (v === null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) < 200) ? (v as number | null) : undefined);
    const values = columnKeys.map((k) => col(obj[k]));
    if (values.some((v) => v === undefined) || typeof obj.dayFirst !== "boolean") return null;
    const [date, description, amount, debit, credit, drCr, balance] = values as (number | null)[];
    if (date === null || description === null) return null;
    return { date, description, amount, debit, credit, drCr, balance, dayFirst: obj.dayFirst };
}

async function parse(input: CommonInput): Promise<ParseResult> {
    return parseStatement({
        buffer: input.buffer,
        fileName: input.file.name,
        password: input.password,
        account: input.account,
        accountType: input.accountType,
        mapping: input.mapping,
        rememberedMapping: (signature) => findLayout(signature)?.mapping ?? null,
    });
}

/** Turns parser errors into messages that are safe and useful to show. */
function explain(error: unknown): { error: string; needsPassword?: boolean } {
    if (error instanceof PdfPasswordError) {
        return {
            error: error.reason === "required" ? "This PDF is password-protected. Enter its password to continue." : "That password didn't work. Please try again.",
            needsPassword: true,
        };
    }
    if (error instanceof PdfNoTextError || error instanceof StatementFormatError) return { error: error.message };
    //In production log only the error type, since parser messages can quote file contents.
    //On your own machine (development) the message is shown too, to make problems diagnosable.
    const detail = error instanceof Error ? (process.env.NODE_ENV === "production" ? error.name : `${error.name}: ${error.message.slice(0, 300)}`) : typeof error;
    console.error("Statement import failed:", detail);
    return { error: "Couldn't read this file. If it's a PDF, try the CSV or Excel version of the statement." };
}

export async function previewImport(formData: FormData): Promise<PreviewResult> {
    const input = await readCommonInput(formData);
    if (typeof input === "string") return { ok: false, error: input };

    try {
        const result = await parse(input);
        const duplicates = existingFingerprints(result.rows.map((r) => r.fingerprint));
        return {
            ok: true,
            fileName: input.file.name,
            headers: result.headers,
            mapping: result.mapping,
            usedRememberedMapping: result.usedRememberedMapping,
            accountType: input.accountType,
            suggestedAccountType: result.suggestedAccountType,
            warnings: result.warnings,
            rows: result.rows.map(({ fingerprint, ...row }) => ({ ...row, duplicate: duplicates.has(fingerprint) })),
        };
    } catch (error) {
        return { ok: false, ...explain(error) };
    }
}

type RowEdit = { index: number; kind: Kind; category: Category; skip: boolean };

function parseEdits(text: string): RowEdit[] | null {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return null;
    }
    if (!Array.isArray(raw) || raw.length > MAX_ROW_EDITS) return null;
    const edits: RowEdit[] = [];
    for (const item of raw) {
        if (typeof item !== "object" || item === null) return null;
        const { index, kind, category, skip } = item as Record<string, unknown>;
        if (!Number.isInteger(index) || typeof skip !== "boolean") return null;
        if (!KINDS.includes(kind as Kind)) return null;
        //Income and transfers always use their own category; everything else needs a spending category.
        const fixed: Category | null = kind === "income" ? "Income" : kind === "transfer" ? "Transfers" : null;
        if (!fixed && !CATEGORIES.includes(category as SpendingCategory)) return null;
        edits.push({ index: index as number, kind: kind as Kind, category: fixed ?? (category as Category), skip });
    }
    return edits;
}

export async function commitImport(formData: FormData): Promise<CommitResult> {
    const input = await readCommonInput(formData);
    if (typeof input === "string") return { ok: false, error: input };
    const edits = parseEdits(String(formData.get("edits") ?? "[]"));
    if (!edits) return { ok: false, error: "The changes you made to the rows are not valid. Please preview the file again." };

    let result: ParseResult;
    try {
        result = await parse(input); //parse again on the server rather than trusting rows sent back by the browser
    } catch (error) {
        return { ok: false, error: explain(error).error };
    }

    const byIndex = new Map(edits.map((e) => [e.index, e]));
    const already = existingFingerprints(result.rows.map((r) => r.fingerprint));
    const toSave: ParsedRow[] = [];
    let skipped = 0;
    for (const row of result.rows) {
        const edit = byIndex.get(row.index);
        if (already.has(row.fingerprint) || edit?.skip) {
            skipped++;
            continue;
        }
        toSave.push(edit ? { ...row, kind: edit.kind, category: edit.category } : row);
    }
    if (toSave.length === 0) return { ok: false, error: "Nothing new to import: every transaction in this file is already saved or was skipped." };

    const { inserted } = saveImport({
        fileName: input.file.name.slice(0, 200),
        account: input.account,
        accountType: input.accountType,
        signature: result.signature,
        mapping: result.mapping,
        rows: toSave,
    });

    revalidatePath("/", "layout");
    return { ok: true, inserted, skipped: skipped + (toSave.length - inserted) };
}

export async function undoImport(formData: FormData): Promise<void> {
    const id = Number(formData.get("id"));
    if (Number.isInteger(id) && id > 0) {
        deleteImport(id);
        revalidatePath("/", "layout");
    }
}
