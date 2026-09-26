import CategoryBreakdown from "@/components/CategoryBreakdown";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { currentMonth, formatAmount, formatMonth } from "@/lib/format";
import { getMonthSummary } from "@/lib/transactions";

//Read fresh data from the database on every visit
export const dynamic="force-dynamic";

export default function DashboardPage() {
  const month = currentMonth();
  const summary = getMonthSummary(month);
  const net = summary.netSpendPaise;
  const isNetRefund = net < 0; //refunds larger than spending this month
  const top = summary.byCategory.find((c) => c.netPaise > 0);

    return (
        <div className="space-y-8">
            <section>
                <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
                <p className="mt-1 text-sm text-muted">Your spending for {formatMonth(month)}.</p>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Spent this month"
                    value={isNetRefund ? `-${formatAmount(-net)}` : formatAmount(net)}
                    tone={isNetRefund ? "positive" : "default"}
                    hint={
                        summary.incomePaise>0
                            ? `Income : ${formatAmount(summary.incomePaise)}` : undefined
                    }
                />

                <StatCard label="Transactions" value={String(summary.count)} hint="This month" />
                <StatCard
                    label="Top category"
                    value={top ? top.category : "—"}
                    hint={top ? formatAmount(top.netPaise) : "No spending yet"}
                />
            </section>

            {summary.byCategory.length === 0 ? (
                <EmptyState
                    title="No spending this month"
                    description="Add a transaction to start tracking your spending."
                    actionHref="/transactions"
                    actionLabel="Add a transaction"
                />
            ) : (
            <CategoryBreakdown items={summary.byCategory} />
        )}
        </div>
    );
}