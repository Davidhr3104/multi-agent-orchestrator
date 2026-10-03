import Link from "next/link";
import { cn } from "@/lib/utils";

export const OPERATOR_REQUIRED = "Operator unlock required.";

export function isOperatorRequired(error: string | null | undefined): boolean {
  return error === OPERATOR_REQUIRED;
}

/** Error line for API calls; the operator 401 becomes a pointer to the unlock screen instead of a bare message. */
export function ApiErrorLine({ error, className }: { error: string; className?: string }) {
  if (!isOperatorRequired(error)) return <p className={cn("text-[#dc2626]", className)}>{error}</p>;
  return (
    <p role="alert" className={cn("text-amber-600 dark:text-amber-300", className)}>
      Operator unlock required —{" "}
      <Link href="/operator" className="font-medium underline underline-offset-2 hover:text-foreground">
        unlock at /operator
      </Link>{" "}
      to use Claude/real sends.
    </p>
  );
}
