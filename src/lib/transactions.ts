import { db } from "@/lib/db";
import type { Category, CategoryTotal, Kind, NewTransaction, Transaction } from "@/types";

//Shape of a row as SQLite returns it(snake_case column names)
type Row = {
  id: number;
  date: string;
  description: string;
  amount_paise: number;
  kind: string;
  category: string;
  account: string;
  created_at: string;
};

function toTransaction(row: Row): Transaction {
    return {
        id: row.id,
        date: row.date,
        description: row.description,
        amountPaise: row.amount_paise,
        kind: row.kind as Kind,
        category: row.category as Category,
        account: row.account,
        createdAt: row.created_at,
    };
}

export function listTransactions(): Transaction[] {
    const rows=db
        .prepare("SELECT * FROM transactions ORDER BY date DESC, id DESC")
        .all() as Row[];
    return rows.map(toTransaction);
}

export function insertTransaction(t: NewTransaction): void {
    db.prepare(
        `INSERT INTO transactions (date, description, amount_paise, kind, category, account)
        VALUES (@date, @description, @amountPaise, @kind, @category, @account)`,
    ).run(t);
}

export function deleteTransaction(id: number): void {
    db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
}

/** Months that have at least one transaction, newest first, e.g. ["2026-09", "2026-08"]. */
export function listMonths(): string[] {
    const rows = db
        .prepare("SELECT DISTINCT substr(date, 1, 7) AS month FROM transactions ORDER BY month DESC")
        .all() as { month: string }[];
    return rows.map((r) => r.month);
}

type MonthTotals = {netSpendPaise: number; incomePaise: number; count: number};

/** 
 * Totals for one month, 'month' looks like 2026-09
 * Spending is NET: refunds are subtracted from expenses. Income is kept separate.
 */
export function getMonthSummary(month: string): MonthTotals & { byCategory: CategoryTotal[] } {
    const totals = db
        .prepare(
            `SELECT
                COALESCE(SUM(CASE kind WHEN 'expense' THEN amount_paise
                    WHEN 'refund' THEN -amount_paise
                    ELSE 0 END), 0)
                    AS netSpendPaise,
                COALESCE(SUM(CASE WHEN kind='income' THEN amount_paise END), 0) AS incomePaise,
                COUNT(*) AS count
            FROM transactions
            WHERE substr(date, 1, 7) = ?`,
        )
        .get(month) as MonthTotals;

    const byCategory = db
        .prepare(
            `SELECT category,
                SUM(CASE kind WHEN 'expense' THEN amount_paise ELSE -amount_paise END) AS netPaise,
                COUNT(*) AS count
            FROM transactions
            WHERE substr(date, 1, 7) = ? AND kind IN ('expense', 'refund')
            GROUP BY category
            HAVING netPaise <> 0
            ORDER BY netPaise DESC`,
        )
        .all(month) as CategoryTotal[];

    return { 
        netSpendPaise: totals.netSpendPaise,
        incomePaise: totals.incomePaise,
        count: totals.count,
        byCategory
    };
}