// First-guess type and category for an imported row. The user can change both in the preview.

import type { Category, Kind } from "@/types";
import type { AccountType } from "./types";

// A credit on a card statement that is the bill being paid, not a refund.
const CARD_PAYMENT_RECEIVED =
    /PAYMENT\s*RECEIVED|PAYMENT\s*RECD|BBPS\s*PAYMENT|CREDIT\s*CARD\s*PAYMENT|CC\s*PAYMENT|THANK\s*YOU\s*FOR\s*(THE\s*)?PAYMENT|AUTOPAY\s*PAYMENT|PAYMENT\s*-\s*THANK/;

// A debit on a bank statement that pays a credit card bill.
const CARD_BILL_PAID =
    /CREDIT\s*CARD|CC\s*BILL|CCBILL|CARD\s*BILL|BILLPAY.*X{3,}\d{3,}|BBPS.*X{3,}\d{3,}|\bCRED\b|CRED\s*CLUB/;

const REFUND_WORDS = /REFUND|REVERSAL|\bREV\b|CASHBACK|CASH\s*BACK|CHARGEBACK/;

export function classify(
    description: string,
    direction: "debit" | "credit",
    accountType: AccountType,
): { kind: Kind; category: Category } {
    const d = description.toUpperCase();

    if (accountType === "credit_card") {
        if (direction === "debit") return { kind: "expense", category: "Others" };
        if (CARD_PAYMENT_RECEIVED.test(d)) return { kind: "transfer", category: "Transfers" };
        return { kind: "refund", category: "Others" };
    }

    // Bank account
    if (direction === "debit") {
        if (CARD_BILL_PAID.test(d)) return { kind: "transfer", category: "Transfers" };
        return { kind: "expense", category: "Others" };
    }
    if (REFUND_WORDS.test(d)) return { kind: "refund", category: "Others" };
    return { kind: "income", category: "Income" };
}
