import type { Metadata } from "next";
import ImportHistory from "@/components/ImportHistory";
import ImportWizard from "@/components/ImportWizard";
import { listAccounts, listImports } from "@/lib/imports";

export const metadata: Metadata = {
    title: "Import Statements | Expense Tracker",
    description: "Import your bank and credit card statements here.",
};

//Read fresh data from the database on every visit
export const dynamic = "force-dynamic";

export default function ImportPage() {
    return (
        <div className="space-y-6">
            <section>
                <h1 className="text-2xl font-semibold tracking-tight">Import Statements</h1>
                <p className="mt-1 text-sm text-muted">
                    Upload a bank or credit card statement, check the transactions, then save them.
                </p>
            </section>

            <ImportWizard accounts={listAccounts()} />
            <ImportHistory imports={listImports()} />
        </div>
    );
}
