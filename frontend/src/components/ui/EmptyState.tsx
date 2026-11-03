import type { ReactNode } from "react";

export function EmptyState({
  icon, title, description, action,
}: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="glass card-edge flex flex-col items-center rounded-3xl px-6 py-16 text-center">
      {icon && <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</span>}
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}



export function ErrorState({
  message, onRetry, title = "Couldn't load this section",
}: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/25 bg-danger/8 px-5 py-4 text-sm text-danger">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 opacity-90">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs font-semibold underline underline-offset-2">Try again</button>
      )}
    </div>
  );
}