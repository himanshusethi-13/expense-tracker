import Link from "next/link";

type EmptyStateProps = {
    title: string;
    description: string;
    actionHref?: string;
    actionLabel?: string;
};

export default function EmptyState({ title, description, actionHref, actionLabel }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
            <h2 className="text-base font-medium">{title}</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
            {actionHref && actionLabel && (
                <Link
                    href={actionHref}
                    className="mt-5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                    {actionLabel}
                </Link>
            )}
        </div>
    );
}