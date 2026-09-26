import {formatAmount} from "@/lib/format";      
import type {CategoryTotal} from "@/types";

type Props={
    items: CategoryTotal[]; //net amount per category, largest first
};

export default function CategoryBreakdown({items}: Props) {
    //Percentage and bar length are each category's share of the total net spending,
    //so the bars add up to 100%. Refund-only categories do not get a bar.
    const positiveTotal = items.reduce((sum, i) => sum + Math.max(i.netPaise, 0), 0);
    
    return (
        <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-medium">Spending by Category</h2>
            <p className="mt-1 text-xs text-muted">Net of refunds</p>
            <ul className="mt-4 space-y-3">
                {items.map((item) => {
                    const isNetRefund = item.netPaise < 0;
                    const sharePercent =
                        !isNetRefund && positiveTotal > 0
                        ? (item.netPaise / positiveTotal) * 100 : 0;
                    
                    return (
                        <li key={item.category}>
                            <div className="flex items-baseline justify-between gap-4 text-sm">
                                <span>{item.category}</span>
                                {isNetRefund ? (
                                    <span className="tabular-nums text-accent">
                                        -{formatAmount(-item.netPaise)}
                                        <span className="ml-2 text-xs text-muted">Refund</span>
                                    </span>
                                ) : (
                                    <span className="tabular-nums">
                                        {formatAmount(item.netPaise)}
                                        <span className="ml-2 text-xs text-muted">{Math.round(sharePercent)}%</span>
                                    </span>
                                )}
                            </div>

                            <div className="mt-1.5 h-2 rounded-full bg-foreground/5">
                                {!isNetRefund && (
                                    <div
                                        className="h-2 rounded-full bg-accent"
                                        style={{width: `${sharePercent}%`}}
                                        aria-hidden
                                    />
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}