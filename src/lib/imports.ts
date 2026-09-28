// Database access for statement imports: the import log, remembered layouts, and saving rows.

import { db } from "@/lib/db";
import type { AccountType, ColumnMapping, ParsedRow } from "@/lib/import";

export type ImportRecord = {
    id: number;
    fileName: string;
    account: string;
    accountType: AccountType;
    rowCount: number;
    importedAt: string;
};

export function listImports(): ImportRecord[] {
    return db
        .prepare(
            `SELECT i.id, i.file_name AS fileName, i.account, i.account_type AS accountType,
                    (SELECT COUNT(*) FROM transactions t WHERE t.import_id = i.id) AS rowCount,
                    i.imported_at AS importedAt
             FROM imports i
             ORDER BY i.id DESC`,
        )
        .all() as ImportRecord[];
}

/** Account names already in use, so the import form can suggest them. */
export function listAccounts(): string[] {
    const rows = db
        .prepare("SELECT DISTINCT account FROM transactions WHERE account <> '' ORDER BY account")
        .all() as { account: string }[];
    return rows.map((r) => r.account);
}

export type RememberedLayout = { mapping: ColumnMapping; account: string; accountType: AccountType };

export function findLayout(signature: string): RememberedLayout | null {
    const row = db
        .prepare("SELECT mapping, account, account_type AS accountType FROM import_profiles WHERE signature = ?")
        .get(signature) as { mapping: string; account: string; accountType: AccountType } | undefined;
    if (!row) return null;
    try {
        return { mapping: JSON.parse(row.mapping) as ColumnMapping, account: row.account, accountType: row.accountType };
    } catch {
        return null; // a damaged saved layout is ignored and replaced on the next import
    }
}

/** Which of these fingerprints are already saved (i.e. would be duplicates). */
export function existingFingerprints(fingerprints: string[]): Set<string> {
    const found = new Set<string>();
    const lookup = db.prepare("SELECT 1 FROM transactions WHERE fingerprint = ?");
    for (const fp of fingerprints) if (lookup.get(fp)) found.add(fp);
    return found;
}

type SaveInput = {
    fileName: string;
    account: string;
    accountType: AccountType;
    signature: string;
    mapping: ColumnMapping;
    rows: ParsedRow[];
};

/**
 * Saves an import in one database transaction: all rows go in, or none do.
 * Rows whose fingerprint already exists are skipped. Returns how many were added.
 */
export function saveImport(input: SaveInput): { importId: number; inserted: number } {
    const run = db.transaction(() => {
        const importId = Number(
            db
                .prepare("INSERT INTO imports (file_name, account, account_type, row_count) VALUES (?, ?, ?, 0)")
                .run(input.fileName, input.account, input.accountType).lastInsertRowid,
        );

        const insert = db.prepare(
            `INSERT OR IGNORE INTO transactions
                (date, description, amount_paise, kind, category, account, import_id, fingerprint)
             VALUES (@date, @description, @amountPaise, @kind, @category, @account, @importId, @fingerprint)`,
        );
        let inserted = 0;
        for (const row of input.rows) {
            inserted += insert.run({
                date: row.date,
                description: row.description,
                amountPaise: row.amountPaise,
                kind: row.kind,
                category: row.category,
                account: input.account,
                importId,
                fingerprint: row.fingerprint,
            }).changes;
        }

        db.prepare("UPDATE imports SET row_count = ? WHERE id = ?").run(inserted, importId);
        db.prepare(
            `INSERT INTO import_profiles (signature, mapping, account, account_type)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(signature) DO UPDATE SET
                mapping = excluded.mapping,
                account = excluded.account,
                account_type = excluded.account_type,
                updated_at = datetime('now')`,
        ).run(input.signature, JSON.stringify(input.mapping), input.account, input.accountType);

        return { importId, inserted };
    });
    return run();
}

/** Removes an import and every transaction it added. */
export function deleteImport(id: number): void {
    const run = db.transaction(() => {
        db.prepare("DELETE FROM transactions WHERE import_id = ?").run(id);
        db.prepare("DELETE FROM imports WHERE id = ?").run(id);
    });
    run();
}
