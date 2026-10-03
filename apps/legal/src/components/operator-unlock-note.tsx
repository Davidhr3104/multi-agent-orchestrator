import Link from "next/link";
import { cn } from "@/lib/utils";

export const OPERATOR_UNLOCK_ERROR = "Operator unlock required.";

export function isOperatorLocked(status: number, error: unknown): boolean {
  return status === 401 && error === OPERATOR_UNLOCK_ERROR;
}

export function OperatorUnlockNote({ className }: { className?: string }) {
  return (
    <p className={cn("rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-100", className)}>
      Operator unlock required — unlock at{" "}
      <Link href="/operator" className="font-semibold underline underline-offset-2 hover:text-white">
        /operator
      </Link>{" "}
      to use Claude and real SAM.gov imports.
    </p>
  );
}
