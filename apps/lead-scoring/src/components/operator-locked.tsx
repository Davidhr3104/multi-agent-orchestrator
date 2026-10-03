import Link from "next/link";
import { cn } from "@/lib/utils";

export const OPERATOR_LOCKED_ERROR = "Operator unlock required.";

export function isOperatorLocked(status: number, error?: string | null): boolean {
  return status === 401 && error === OPERATOR_LOCKED_ERROR;
}

export function OperatorLockedNotice({
  action,
  onDismiss,
  className,
}: {
  action: string;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-on-surface",
        className
      )}
    >
      <p className="flex-1">
        {action} needs the operator key: it calls a real CRM or a paid AI model, or changes a live desk. Demo
        actions stay open to everyone.{" "}
        <Link href="/operator" className="font-semibold text-primary underline">
          Unlock operator mode
        </Link>
      </p>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="text-outline hover:text-on-surface" aria-label="Dismiss">
          ×
        </button>
      ) : null}
    </div>
  );
}
