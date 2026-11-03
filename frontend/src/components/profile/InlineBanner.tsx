"use client";

export function InlineBanner({
  kind,
  message,
}: {
  kind: "success" | "error";
  message: string;
}) {
  const styles =
    kind === "success"
      ? "border-success/30 bg-success/10 text-success"
      : "border-danger/30 bg-danger/10 text-danger";

  return (
    <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${styles}`} role="status">
      {message}
    </div>
  );
}
