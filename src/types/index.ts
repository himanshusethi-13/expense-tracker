// Core data shapes for the application. Statement import and storage will build on these.

export type Category = 
    | "Grocieries"
    | "Dining"
    | "Transport"
    | "Shopping"
    | "Bills & Utilities"
    | "Rent"
    | "Entertainment"
    | "Health & Fitness"
    | "Travel"
    | "Investments"
    | "Transfers"
    | "Others";

export type AccountType = "Bank" | "Credit Card";

export type Transaction = {
    id: string;
    date: string; //ISO date, e.g. 2026-09-14
    description: string; //raw narration from the statement
    amount: number; //positive for debit, negative for credit
    category: Category;
    account: string; //e.g. "HDFC Regalia", "ICICI Savings", "HSBC Credit Card"
    accountType: AccountType;
};
    