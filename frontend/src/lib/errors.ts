/** Safe replacement for `catch (e: any) { e.message }` - works with whatever was thrown. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
