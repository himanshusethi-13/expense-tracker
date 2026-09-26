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
}

//Reuse one connection, even when the dev server hot reloads the code. This is important because better-sqlite3 does not support multiple connections to the same database file.
const globalForDb = globalThis as unknown as { expenseDb?: Database.Database };

export const db = globalForDb.expenseDb ?? openDatabase();

if (process.env.NODE_ENV !== "production") {
    globalForDb.expenseDb = db;
}