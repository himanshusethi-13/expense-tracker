"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/import", label: "Import" },
];

export default function Header() {
  const pathname = usePathname();

    return (
        <header className="border-b border-border bg-surface">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6 ">
                <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
                    Expense Tracker
                </Link>
                <nav className="flex items-center gap-1 text-sm">
                        {links.map(({ href, label }) => {
                            const active = pathname === href;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    aria-current={active ? "page" : undefined}
                                    className={`rounded-md px-3 py-1.5 transition-colors ${
                                        active
                                            ? "bg-foreground/5 font-medium text-foreground"
                                            : "text-muted hover:text-foreground"
                                    }`}
                                >
                                    {label}
                                </Link>
                            );
                        })}
                </nav>
            </div>
        </header>
    );
}