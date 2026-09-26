import type { Metadata } from "next";
import AddTransactionForm from "@/components/AddTransactionForm";
import EmptyState from "@/components/EmptyState";
import TransactionTable from "@/components/TransactionTable";
import {todayISO} from "@/lib/format";
import { listTransactions } from "@/lib/transactions";

export const metadata: Metadata = { title: "Transactions | Expense Tracker"};

//Read fresh data from the database on every visit
export const dynamic="force-dynamic";

export default function TransactionsPage() {
  const transactions = listTransactions();

  return (
    <div className="space-y-6">
        <section>
            <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
            <p className="mt-1 text-sm text-muted">
                Add expenses manually for now. Statement Import will be available soon.
            </p>
        </section>

        <AddTransactionForm defaultDate={todayISO()} />

        {transactions.length === 0 ? (
          <EmptyState
            title="No Transactions Yet"
            description="Add your first transaction using the form above."
          />
        ) : (
          <TransactionTable transactions={transactions} />
        )}
    </div>
  );
}