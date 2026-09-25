import type { Metadata } from "next";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Transactions | Expense Tracker",
  description: "View your transaction history and details.",
};

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
        <section>
            <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
            <p className="mt-1 text-sm text-muted">
                Every line from your statements, categorised. You&apos;ll be able to filter and re-categorise your transactions here.
            </p>
        </section>
      
      <EmptyState
        title="No Transactions Found"
        description="Transactions will appear here once you import your bank statements or add them manually."
        actionHref="/import"
        actionLabel="Import Statement"
      />
    </div>
  );
}