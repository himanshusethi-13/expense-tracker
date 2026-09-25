import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
// Placeholder values — these will come from imported statements later.
const monthTotal = 0;
const transactionCount = 0;

return (
<div className="space-y-8">
<section>
<h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
<p className="mt-1 text-sm text-muted">
Your spending across credit cards and bank accounts, by month and category.
</p>
</section>

<section className="grid gap-4 sm:grid-cols-3">
<StatCard label="Spent this month" value={formatCurrency(monthTotal)} />
<StatCard label="Transactions" value={String(transactionCount)} hint="This month" />
<StatCard label="Top category" value="—" hint="Import a statement to see this" />
</section>

<EmptyState
title="No transactions yet"
description="Import a credit card or bank statement to start sorting your expenses into categories."
actionHref="/import"
actionLabel="Import a statement"
/>
</div>
);
}