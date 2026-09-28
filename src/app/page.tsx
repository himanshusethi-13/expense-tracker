import CategoryBreakdown from "@/components/CategoryBreakdown";
import EmptyState from "@/components/EmptyState";
import MonthNav from "@/components/MonthNav";
import StatCard from "@/components/StatCard";
import { currentMonth, formatAmount, formatMonth, isValidMonth } from "@/lib/format";
import { getMonthSummary, listMonths } from "@/lib/transactions";

//Read fresh data from the database on every visit
export const dynamic="force-dynamic";

type DashboardProps = {
    searchParams: Promise<{ month?: string | string[] }>;
};

export default async function DashboardPage({ searchParams }: DashboardProps) {
    //The month comes from the URL (?month=2026-08) so it can be bookmarked; anything invalid falls back to this month.
    const requested = (await searchParams).month;
    const month = typeof requested === "string" && isValidMonth(requested) ? requested : currentMonth();

    const months = listMonths();
    const summary = getMonthSummary(month);
    const net = summary.netSpendPaise;
    const isNetRefund = net < 0; //refunds larger than spending this month
    const top = summary.byCategory.find((c) => c.netPaise > 0);
    const latestWithData = months.find((m) => m !== month);

    return (
        <div className="space-y-8">
            <section className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
                    <p className="mt-1 text-sm text-muted">Your spending for {formatMonth(month)}.</p>
                </div>
                <MonthNav month={month} months={months} />
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
                latestWithData && summary.count === 0 ? (
                    <EmptyState
                        title={`No transactions in ${formatMonth(month)}`}
                        description={`Your statements have transactions in other months, such as ${formatMonth(latestWithData)}.`}
                        actionHref={`/?month=${latestWithData}`}
                        actionLabel={`View ${formatMonth(latestWithData)}`}
                    />
                ) : (
                    <EmptyState
                        title="No spending this month"
                        description="Add a transaction to start tracking your spending."
                        actionHref="/transactions"
                        actionLabel="Add a transaction"
                    />
                )
            ) : (
            <CategoryBreakdown items={summary.byCategory} />
        )}
        </div>
    );
}
