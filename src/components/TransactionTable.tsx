import {removeTransaction} from "@/app/actions";
import {formatAmount, formatDate} from "@/lib/format";
import type {Transaction} from "@/types";

export default function TransactionTable({transactions}:{transactions: Transaction[]}) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs text-muted">
                    <tr>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {transactions.map((t) => {
                        const isMoneyIn = t.kind !== "expense"; //refunds and income
                        return (
                            <tr key={t.id}>
                                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(t.date)}</td>
                                <td className="px-4 py-3">
                                    <div>{t.description}</div>
                                    {t.account && <div className="text-xs text-muted">{t.account}</div>}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="whitespace-nowrap rounded-full bg-foreground/5 px-2 py-0.5 text-xs">
                                        {t.category}
                                        {t.kind === "refund" && " . Refund"}
                                    </span>
                                </td>
                                <td
                                    className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${
                                        isMoneyIn ? "text-accent" : ""
                                    }`}
                                >
                                    {isMoneyIn ? "+ " : ""}
                                    {formatAmount(t.amountPaise)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <form action={removeTransaction}>
                                        <input type="hidden" name="id" value={t.id} />
                                        <button type="submit" className="text-xs text-muted hover:text-red-600">
                                            Delete
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        );
                    })} 
                </tbody>
            </table>
        </div>
    );
}