"use server";

//Server Actions: functions the browser can call to perform server-side operations, like database queries. These functions are not directly accessible from the browser, but can be called from client components using the 'use server' directive.
//This is the only place that can directly access the database. Client components cannot access the database directly, they must call server actions to perform database operations.

import { revalidatePath } from "next/cache";
import { insertTransaction, deleteTransaction } from "@/lib/transactions";
import { CATEGORIES, KINDS, type Category, type Kind, type SpendingCategory } from "@/types";

export type FormState = { ok: boolean; message: string };

export async function addTransaction(_prev: FormState, formData: FormData): Promise<FormState> {
    const date = String(formData.get("date") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const amount = Number(formData.get("amount"));
    const kind = String(formData.get("kind") ?? "");
    const categoryInput = String(formData.get("category") ?? "");
    const account = String(formData.get("account") ?? "").trim();

    //Validate on the server too- never trusts what the client/browser sends
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { ok: false, message: "Please enter a valid date" };
    }
    if (!description) {
        return { ok: false, message: "Please enter a description" };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, message: "Amount must be a number greater than 0" };
    }
    if (!KINDS.includes(kind as Kind)) {
        return { ok: false, message: "Please choose a type" };
    }

    //Salary or Income always goes under "Income", transfers under "Transfers": expenses and refunds need a spending category
    let category: Category;
    if (kind === "income") {
        category = "Income";
    } else if (kind === "transfer") {
        category = "Transfers";
    } else if (CATEGORIES.includes(categoryInput as SpendingCategory)) {
        category = categoryInput as SpendingCategory;
    } else {
        return { ok: false, message: "Please choose a category" };
    }

    insertTransaction({ 
        date,
        description,
        amountPaise: Math.round(amount * 100), //always stored as a positive number
        kind: kind as Kind,
        category,
        account,
    });

    revalidatePath("/", "layout"); //refresh every page that shows transactions
    return {ok:true, message: `Added "${description}".`};
}

export async function removeTransaction(formData:FormData): Promise<void> {
    const id= Number(formData.get("id"));
    if(Number.isInteger(id) && id>0){
        deleteTransaction(id);
        revalidatePath("/", "layout");
    }
}