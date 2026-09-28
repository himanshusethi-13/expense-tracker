"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMonth, shiftMonth } from "@/lib/format";

type MonthNavProps = {
    month: string; // the month being shown, "YYYY-MM"
    months: string[]; // months that have transactions, newest first
};

const arrowClass =
    "rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-foreground/5";

/** Previous / next arrows plus a dropdown of every month that has transactions. */
export default function MonthNav({ month, months }: MonthNavProps) {
    const router = useRouter();
    const options = months.includes(month) ? months : [month, ...months].sort().reverse();

    return (
        <nav aria-label="Choose month" className="flex items-center gap-2">
            <Link href={`/?month=${shiftMonth(month, -1)}`} className={arrowClass} aria-label="Previous month">
                ‹
            </Link>
            <select
                aria-label="Month"
                value={month}
                onChange={(e) => router.push(`/?month=${e.target.value}`)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground/40"
            >
                {options.map((m) => (
                    <option key={m} value={m}>
                        {formatMonth(m)}
                        {months.includes(m) ? "" : " (no transactions)"}
                    </option>
                ))}
            </select>
            <Link href={`/?month=${shiftMonth(month, 1)}`} className={arrowClass} aria-label="Next month">
                ›
            </Link>
        </nav>
    );
}
