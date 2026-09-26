"use client";

import { useActionState, useState } from "react";
import { addTransaction, type FormState } from "@/app/actions";
import {CATEGORIES, type Kind} from "@/types";

const initialState: FormState = {ok: false, message: ""};

const fieldClass = 
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-xs font-medium text-muted";

export default function AddTransactionForm({defaultDate}:{defaultDate: string}) {
    const [state, formAction, pending] = useActionState(addTransaction, initialState);
    const [kind, setKind] = useState<Kind>("expense"); //hides Category for salary/income

    return (
        <form action={formAction} className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-medium">Add Transaction</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className={labelClass}>
                    <span className={labelTextClass}>Date</span>
                    <input type="date" name="date" required defaultValue={defaultDate} className={fieldClass} />
                </label>

                <label className={` ${labelClass} lg:col-span-2`}>
                    <span className={labelTextClass}>Description</span>
                    <input 
                        type="text"
                        name="description"
                        required
                        maxLength={200}
                        placeholder="e.g. Swiggy order"
                        className={fieldClass}
                    />
                </label>

                <label className={labelClass}>
                    <span className={labelTextClass}>Amount (₹)</span>
                    <input
                        type="number"
                        name="amount"
                        required
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        className={fieldClass}
                    />
                </label>

                <label className={labelClass}>
                    <span className={labelTextClass}>Type</span>
                    <select
                        name="kind" 
                        value={kind}
                        onChange={(e) => setKind(e.target.value as Kind)}
                        className={fieldClass}
                    >
                        <option value="expense">Expense</option>
                        <option value="refund">Refund/Rebate</option>
                        <option value="income">Salary / Income</option>
                    </select>
                </label>

                {kind !== "income" && (
                <label className={labelClass}>
                    <span className={labelTextClass}>Category</span>
                    <select name="category" required defaultValue="" className={fieldClass}>
                        <option value="" disabled>Choose...</option>
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </label>
                )}

                <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
                    <span className={labelTextClass}>Account (optional)</span>
                    <input
                        type="text"
                        name="account" 
                        maxLength={100}
                        placeholder="e.g. HDFC Bank Credit Card"
                        className={fieldClass}
                    />
                </label>
            </div>

            <div className="mt-5 flex items-center gap-3">
                <button
                    type="submit" 
                    disabled={pending}
                    className="rounded md- bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    {pending ? "Saving..." : "Add Transaction"}
                </button>
                {state.message && (
                    <p role="status" className={`text-sm ${state.ok ? "text-accent" : "text-red-600"}`}>
                        {state.message}
                    </p>
                )}
            </div>
        </form>
    );
}