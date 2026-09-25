import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import Statements | Expense Tracker",
  description: "Import your bank and credit card statements here.",
};

export default function ImportPage() {
    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl font-semibold tracking-tight">Import Statements</h1>
                <p className="mt-1 text-sm text-muted">
                    Import your bank and credit card statements here. You can upload CSV files.
                </p>
            </section>

            <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
                <p className="text-sm font-medium">Statement upload coming soon</p>
                <p className="mt-1 text-sm text-muted">
                    This is where you&apos;ll drop a CSV and map its columns to date, description and amount
                </p>
            </div>
        </div>
    );
}