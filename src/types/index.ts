// Core data shapes for the application. Statement import and storage will build on these.

//Categories used for expenses and refunds
export const CATEGORIES = [
    "Groceries",
    "Dining",
    "Transport",
    "Shopping",
    "Bills & Utilities",
    "Rent",
    "Entertainment",
    "Health & Fitness",
    "Travel",
    "Investments",
    "Transfers",
    "Refunds",
    "Others"
] as const;

export type SpendingCategory = (typeof CATEGORIES)[number];

//Salary and other incomes are stored under "Income", which never counts as spending.
export type Category = SpendingCategory | "Income";

//expense is money spent, refund is money returned against a category, income is salary etc.
export const KINDS = ["expense", "refund", "income"] as const;
export type Kind = (typeof KINDS)[number];

export type Transaction = {
    id: number; //unique identifier for the transaction
    date: string; //ISO date, e.g. 2026-09-14
    description: string; //raw narration from the statement
    amountPaise: number; //positive for debit, negative for credit
    kind: Kind;
    category: Category;
    account: string; //e.g. "HDFC Regalia", "ICICI Savings", "HSBC Credit Card"
    createdAt: string; //ISO date, e.g. 2026-09-14
};

//What the form sends to the backend when creating a new transaction (the database fills in the id and createdAt fields)
export type NewTransaction = Omit<Transaction, "id" | "createdAt">;

export type CategoryTotal = {
    category: Category;
    netPaise: number; //expense-refunds for each category
    count: number;
};