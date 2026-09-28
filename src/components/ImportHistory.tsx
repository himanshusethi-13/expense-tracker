import { undoImport } from "@/app/import/actions";
import type { ImportRecord } from "@/lib/imports";

function formatImportedAt(value: string): string {
    // SQLite stores UTC as "YYYY-MM-DD HH:MM:SS"; show it in the viewer's local time.
    const date = new Date(`${value.replace(" ", "T")}Z`);
    return date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ImportHistory({ imports }: { imports: ImportRecord[] }) {
    if (imports.length === 0) return null;
    return (
        <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-medium">Past imports</h2>
            <p className="mt-1 text-xs text-muted">Undo removes every transaction that import added.</p>
            <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="border-b border-border text-left text-xs text-muted">
                        <tr>
                            <th className="py-2 pr-4 font-medium">Imported</th>
                            <th className="py-2 pr-4 font-medium">File</th>
                            <th className="py-2 pr-4 font-medium">Account</th>
                            <th className="py-2 pr-4 text-right font-medium">Transactions</th>
                            <th className="py-2">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {imports.map((imp) => (
                            <tr key={imp.id}>
                                <td className="whitespace-nowrap py-2 pr-4 text-muted">{formatImportedAt(imp.importedAt)}</td>
                                <td className="py-2 pr-4 break-all">{imp.fileName}</td>
                                <td className="py-2 pr-4">
                                    {imp.account}
                                    <span className="ml-1 text-xs text-muted">
                                        ({imp.accountType === "credit_card" ? "card" : "bank"})
                                    </span>
                                </td>
                                <td className="py-2 pr-4 text-right tabular-nums">{imp.rowCount}</td>
                                <td className="py-2 text-right">
                                    <form action={undoImport}>
                                        <input type="hidden" name="id" value={imp.id} />
                                        <button type="submit" className="text-xs text-muted hover:text-red-600">
                                            Undo
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
