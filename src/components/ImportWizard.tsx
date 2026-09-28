"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { commitImport, previewImport, type PreviewResult } from "@/app/import/actions";
import type { AccountType, ColumnMapping } from "@/lib/import/types";
import { formatAmount, formatDate } from "@/lib/format";
import { CATEGORIES, type Category, type Kind } from "@/types";

type Preview = Extract<PreviewResult, { ok: true }>;
type RowChoice = { kind: Kind; category: Category; skip: boolean };

const fieldClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";
const smallFieldClass =
    "rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-foreground/40";
const labelClass = "flex flex-col gap-1.5";
const labelTextClass = "text-xs font-medium text-muted";
const primaryButton =
    "rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50";
const secondaryButton =
    "rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5 disabled:opacity-50";

const KIND_LABELS: Record<Kind, string> = {
    expense: "Expense",
    refund: "Refund",
    income: "Income",
    transfer: "Transfer",
};

/** Income and transfers have a fixed category; expenses and refunds use a spending category. */
function categoryFor(kind: Kind, current: Category): Category {
    if (kind === "income") return "Income";
    if (kind === "transfer") return "Transfers";
    return current === "Income" || current === "Transfers" ? "Others" : current;
}

export default function ImportWizard({ accounts }: { accounts: string[] }) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [account, setAccount] = useState("");
    const [accountType, setAccountType] = useState<AccountType>("bank");
    const [password, setPassword] = useState("");
    const [needsPassword, setNeedsPassword] = useState(false);

    const [preview, setPreview] = useState<Preview | null>(null);
    const [mapping, setMapping] = useState<ColumnMapping | null>(null);
    const [choices, setChoices] = useState<Record<number, RowChoice>>({});
    const [error, setError] = useState("");
    const [done, setDone] = useState("");
    const [isPending, startTransition] = useTransition();

    function formData(extra: Record<string, string> = {}, type: AccountType = accountType): FormData {
        const fd = new FormData();
        if (file) fd.set("file", file);
        fd.set("account", account);
        fd.set("accountType", type);
        fd.set("password", password);
        for (const [k, v] of Object.entries(extra)) fd.set(k, v);
        return fd;
    }

    function runPreview(withMapping: ColumnMapping | null, type: AccountType = accountType) {
        setError("");
        setDone("");
        startTransition(async () => {
            const result = await previewImport(
                formData(withMapping ? { mapping: JSON.stringify(withMapping) } : {}, type),
            );
            if (!result.ok) {
                setError(result.error);
                if (result.needsPassword) setNeedsPassword(true);
                setPreview(null);
                return;
            }
            setPreview(result);
            setMapping(result.mapping);
            setChoices(
                Object.fromEntries(
                    result.rows.map((r) => [r.index, { kind: r.kind, category: r.category, skip: r.duplicate }]),
                ),
            );
        });
    }

    function runImport() {
        if (!preview || !mapping) return;
        const edits = preview.rows.map((r) => ({ index: r.index, ...choices[r.index] }));
        setError("");
        startTransition(async () => {
            const result = await commitImport(
                formData({ mapping: JSON.stringify(mapping), edits: JSON.stringify(edits) }),
            );
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setDone(
                `Imported ${result.inserted} transaction${result.inserted === 1 ? "" : "s"}` +
                    (result.skipped ? ` (${result.skipped} skipped).` : "."),
            );
            reset(false);
        });
    }

    function reset(clearMessages = true) {
        setPreview(null);
        setMapping(null);
        setChoices({});
        setFile(null);
        setPassword("");
        setNeedsPassword(false);
        if (fileInput.current) fileInput.current.value = "";
        if (clearMessages) {
            setError("");
            setDone("");
        }
    }

    function updateChoice(index: number, change: Partial<RowChoice>) {
        setChoices((prev) => {
            const current = prev[index];
            const next = { ...current, ...change };
            if (change.kind) next.category = categoryFor(change.kind, current.category);
            return { ...prev, [index]: next };
        });
    }

    const included = preview ? preview.rows.filter((r) => !choices[r.index]?.skip) : [];
    const duplicates = preview ? preview.rows.filter((r) => r.duplicate).length : 0;
    const moneyOut = included.filter((r) => r.direction === "debit").reduce((sum, r) => sum + r.amountPaise, 0);
    const moneyIn = included.filter((r) => r.direction === "credit").reduce((sum, r) => sum + r.amountPaise, 0);

    return (
        <div className="space-y-6">
            <form
                className="rounded-xl border border-border bg-surface p-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    runPreview(null);
                }}
            >
                <h2 className="text-base font-medium">Upload a statement</h2>
                <p className="mt-1 text-xs text-muted">
                    CSV, Excel (.xls, .xlsx) or PDF. The file is only read to find the transactions; it isn&apos;t stored.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <label className={labelClass}>
                        <span className={labelTextClass}>Statement file</span>
                        <input
                            ref={fileInput}
                            type="file"
                            name="file"
                            required
                            accept=".csv,.txt,.xls,.xlsx,.pdf"
                            onChange={(e) => {
                                setFile(e.target.files?.[0] ?? null);
                                setPreview(null);
                                setNeedsPassword(false);
                                setPassword("");
                            }}
                            className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
                        />
                    </label>

                    <label className={labelClass}>
                        <span className={labelTextClass}>Account name</span>
                        <input
                            type="text"
                            required
                            maxLength={100}
                            list="known-accounts"
                            value={account}
                            onChange={(e) => setAccount(e.target.value)}
                            placeholder="e.g. HDFC Savings"
                            className={fieldClass}
                        />
                        <datalist id="known-accounts">
                            {accounts.map((a) => (
                                <option key={a} value={a} />
                            ))}
                        </datalist>
                    </label>

                    <label className={labelClass}>
                        <span className={labelTextClass}>Account type</span>
                        <select
                            value={accountType}
                            onChange={(e) => setAccountType(e.target.value as AccountType)}
                            className={fieldClass}
                        >
                            <option value="bank">Bank account</option>
                            <option value="credit_card">Credit card</option>
                        </select>
                    </label>

                    {needsPassword && (
                        <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
                            <span className={labelTextClass}>PDF password (used once to open the file, never saved)</span>
                            <input
                                type="password"
                                autoComplete="off"
                                maxLength={200}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={fieldClass}
                            />
                        </label>
                    )}
                </div>

                <p className="mt-3 text-xs text-muted">
                    Use the same account name every time for the same account: it&apos;s how repeated transactions in
                    overlapping statements are recognised and skipped.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={isPending || !file} className={primaryButton}>
                        {isPending && !preview ? "Reading…" : "Preview"}
                    </button>
                    {error && (
                        <p role="alert" className="text-sm text-red-600">
                            {error}
                        </p>
                    )}
                    {done && (
                        <p role="status" className="text-sm text-accent">
                            {done}{" "}
                            <Link href="/" className="underline">
                                View dashboard
                            </Link>
                        </p>
                    )}
                </div>
            </form>

            {preview && mapping && (
                <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-base font-medium">Preview: {preview.fileName}</h2>
                        {preview.usedRememberedMapping && (
                            <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-muted">
                                Recognised layout from a previous import
                            </span>
                        )}
                    </div>

                    {preview.suggestedAccountType && preview.suggestedAccountType !== preview.accountType && (
                        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-600/40 px-4 py-3 text-sm">
                            <span>
                                This looks like a{" "}
                                {preview.suggestedAccountType === "credit_card" ? "credit card" : "bank account"} statement,
                                but <strong>{preview.accountType === "credit_card" ? "Credit card" : "Bank account"}</strong> is
                                selected. The type decides whether money coming in is a refund, a card payment or income.
                            </span>
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={() => {
                                    const type = preview.suggestedAccountType as AccountType;
                                    setAccountType(type);
                                    runPreview(mapping, type);
                                }}
                                className={secondaryButton}
                            >
                                Switch to {preview.suggestedAccountType === "credit_card" ? "Credit card" : "Bank account"}
                            </button>
                        </div>
                    )}

                    <dl className="grid gap-3 text-sm sm:grid-cols-4">
                        <Stat label="Transactions found" value={String(preview.rows.length)} />
                        <Stat label="Already imported" value={String(duplicates)} />
                        <Stat label="Money out (selected)" value={formatAmount(moneyOut)} />
                        <Stat label="Money in (selected)" value={formatAmount(moneyIn)} />
                    </dl>

                    {preview.warnings.length > 0 && (
                        <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
                            {preview.warnings.map((w) => (
                                <li key={w}>{w}</li>
                            ))}
                        </ul>
                    )}

                    <MappingEditor
                        key={`${preview.fileName}-${JSON.stringify(preview.mapping)}`}
                        headers={preview.headers}
                        mapping={mapping}
                        disabled={isPending}
                        onApply={(m) => runPreview(m)}
                    />

                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                            <thead className="border-b border-border text-left text-xs text-muted">
                                <tr>
                                    <th className="px-3 py-2 font-medium">Include</th>
                                    <th className="px-3 py-2 font-medium">Date</th>
                                    <th className="px-3 py-2 font-medium">Description</th>
                                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                                    <th className="px-3 py-2 font-medium">Type</th>
                                    <th className="px-3 py-2 font-medium">Category</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {preview.rows.map((row) => {
                                    const choice = choices[row.index];
                                    if (!choice) return null;
                                    const fixedCategory = choice.kind === "income" || choice.kind === "transfer";
                                    return (
                                        <tr key={row.index} className={choice.skip ? "opacity-50" : ""}>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Include ${row.description}`}
                                                    checked={!choice.skip}
                                                    disabled={row.duplicate}
                                                    onChange={(e) => updateChoice(row.index, { skip: !e.target.checked })}
                                                />
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDate(row.date)}</td>
                                            <td className="px-3 py-2">
                                                <div className="max-w-md break-words">{row.description}</div>
                                                {row.duplicate && <div className="text-xs text-muted">Already imported</div>}
                                            </td>
                                            <td
                                                className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${
                                                    row.direction === "credit" ? "text-accent" : ""
                                                }`}
                                            >
                                                {row.direction === "credit" ? "+ " : ""}
                                                {formatAmount(row.amountPaise)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    aria-label="Type"
                                                    value={choice.kind}
                                                    disabled={choice.skip}
                                                    onChange={(e) => updateChoice(row.index, { kind: e.target.value as Kind })}
                                                    className={smallFieldClass}
                                                >
                                                    {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
                                                        <option key={k} value={k}>
                                                            {KIND_LABELS[k]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                {fixedCategory ? (
                                                    <span className="text-xs text-muted">{choice.category}</span>
                                                ) : (
                                                    <select
                                                        aria-label="Category"
                                                        value={choice.category}
                                                        disabled={choice.skip}
                                                        onChange={(e) =>
                                                            updateChoice(row.index, { category: e.target.value as Category })
                                                        }
                                                        className={smallFieldClass}
                                                    >
                                                        {CATEGORIES.map((c) => (
                                                            <option key={c} value={c}>
                                                                {c}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={runImport}
                            disabled={isPending || included.length === 0}
                            className={primaryButton}
                        >
                            {isPending ? "Working…" : `Import ${included.length} transaction${included.length === 1 ? "" : "s"}`}
                        </button>
                        <button type="button" onClick={() => reset()} disabled={isPending} className={secondaryButton}>
                            Cancel
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-foreground/5 px-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
        </div>
    );
}

type MappingEditorProps = {
    headers: string[];
    mapping: ColumnMapping;
    disabled: boolean;
    onApply: (mapping: ColumnMapping) => void;
};

/** Lets the user correct which column is which, then re-reads the file with their choice. */
function MappingEditor({ headers, mapping, disabled, onApply }: MappingEditorProps) {
    const [draft, setDraft] = useState<ColumnMapping>(mapping);
    const split = draft.debit !== null && draft.credit !== null;

    function set<K extends keyof ColumnMapping>(key: K, value: ColumnMapping[K]) {
        setDraft((d) => ({ ...d, [key]: value }));
    }

    function columnSelect(label: string, value: number | null, onChange: (v: number | null) => void, optional = false) {
        return (
            <label className={labelClass}>
                <span className={labelTextClass}>{label}</span>
                <select
                    value={value ?? ""}
                    onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
                    className={fieldClass}
                >
                    {optional && <option value="">(none)</option>}
                    {headers.map((h, i) => (
                        <option key={i} value={i}>
                            {h}
                        </option>
                    ))}
                </select>
            </label>
        );
    }

    return (
        <details className="rounded-lg border border-border px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">Columns look wrong? Change them</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {columnSelect("Date", draft.date, (v) => set("date", v ?? 0))}
                {columnSelect("Description", draft.description, (v) => set("description", v ?? 0))}
                <label className={labelClass}>
                    <span className={labelTextClass}>Amounts are in</span>
                    <select
                        value={split ? "split" : "single"}
                        onChange={(e) =>
                            e.target.value === "split"
                                ? setDraft((d) => ({ ...d, amount: null, debit: d.amount ?? 0, credit: d.amount ?? 0 }))
                                : setDraft((d) => ({ ...d, amount: d.debit ?? 0, debit: null, credit: null }))
                        }
                        className={fieldClass}
                    >
                        <option value="single">One amount column</option>
                        <option value="split">Separate withdrawal and deposit columns</option>
                    </select>
                </label>
                {split ? (
                    <>
                        {columnSelect("Withdrawal (money out)", draft.debit, (v) => set("debit", v))}
                        {columnSelect("Deposit (money in)", draft.credit, (v) => set("credit", v))}
                    </>
                ) : (
                    <>
                        {columnSelect("Amount", draft.amount, (v) => set("amount", v))}
                        {columnSelect("Dr/Cr column", draft.drCr, (v) => set("drCr", v), true)}
                    </>
                )}
                <label className={labelClass}>
                    <span className={labelTextClass}>Dates are written</span>
                    <select
                        value={draft.dayFirst ? "dmy" : "mdy"}
                        onChange={(e) => set("dayFirst", e.target.value === "dmy")}
                        className={fieldClass}
                    >
                        <option value="dmy">Day first (31/12/2026)</option>
                        <option value="mdy">Month first (12/31/2026)</option>
                    </select>
                </label>
            </div>
            <button
                type="button"
                disabled={disabled}
                onClick={() => onApply(draft)}
                className={`mt-4 ${secondaryButton}`}
            >
                Re-read with these columns
            </button>
        </details>
    );
}
