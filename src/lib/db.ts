import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

//The database file lives in expense-tracker/data/ - that folder is ignored by git.
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "expenses.db");

function openDatabase() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // creates the table the first time, does nothing if the table already exists.
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            description TEXT NOT NULL,
            amount_paise INTEGER NOT NULL,
            kind TEXT NOT NULL DEFAULT 'expense',
            category TEXT NOT NULL,
            account TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
    `);

    upgradeSchema(db);
    return db;
}

//Brings an older database schema up to date with the current structure without losing existing data.
function upgradeSchema(db: Database.Database) {
    // Example: add the 'kind' column if it doesn't exist
    const columns = db.prepare("PRAGMA table_info(transactions)").all() as { name: string }[];
    
    //v1->v2 add 'kind' column. Old "money in" rows were stored as negative
    //amounts; turn them into refunds (or income) with positive amounts.
    if (!columns.some((c) => c.name === "kind")) {
        const upgrade = db.transaction(() => {
            db.exec("ALTER TABLE transactions ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense'");
            db.exec(`
                UPDATE transactions
                    SET kind = CASE WHEN category = 'Income' THEN 'income' ELSE 'refund' END,
                        amount_paise = -amount_paise
                    WHERE amount_paise < 0
            `);
        });
        upgrade();
    }

    //v2->v3 statement import: a log of imports (so one can be undone), remembered column layouts
    //per bank, and on each imported transaction a link to its import plus a fingerprint that
    //stops the same transaction being saved twice when statements overlap.
    if (!columns.some((c) => c.name === "fingerprint")) {
        const upgrade = db.transaction(() => {
            db.exec(`
                CREATE TABLE IF NOT EXISTS imports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_name TEXT NOT NULL,
                    account TEXT NOT NULL,
                    account_type TEXT NOT NULL,
                    row_count INTEGER NOT NULL,
                    imported_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS import_profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    signature TEXT NOT NULL UNIQUE,
                    mapping TEXT NOT NULL,
                    account TEXT NOT NULL,
                    account_type TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                );
                ALTER TABLE transactions ADD COLUMN import_id INTEGER REFERENCES imports(id);
                ALTER TABLE transactions ADD COLUMN fingerprint TEXT;
                CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_fingerprint
                    ON transactions (fingerprint) WHERE fingerprint IS NOT NULL;
                CREATE INDEX IF NOT EXISTS idx_transactions_import ON transactions (import_id);
            `);
            //Categories renamed or removed along the way.
            db.exec(`
                UPDATE transactions SET category = 'Others' WHERE category IN ('Refunds', 'Other');
                UPDATE transactions SET category = 'Health & Fitness' WHERE category = 'Health';
            `);
        });
        upgrade();
    }
}

//Reuse one connection, even when the dev server hot reloads the code. This is important because better-sqlite3 does not support multiple connections to the same database file.
const globalForDb = globalThis as unknown as { expenseDb?: Database.Database };

export const db = globalForDb.expenseDb ?? openDatabase();

if (process.env.NODE_ENV !== "production") {
    globalForDb.expenseDb = db;
}