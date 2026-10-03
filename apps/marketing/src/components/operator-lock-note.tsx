import { cn } from "@/lib/utils";

export const OPERATOR_LOCKED = "Operator unlock required.";

export function isOperatorLocked(status: number, error?: string | null): boolean {
  return status === 401 && error === OPERATOR_LOCKED;
}

export function OperatorLockNote({ className }: { className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-lg border border-marketing-amber/30 bg-marketing-amber/10 px-3 py-2 text-xs text-marketing-amber",
        className
      )}
    >
      <span className="material-symbols-outlined text-[15px]">lock</span>
      <span>Operator unlock required: this touches real ad platforms, paid AI or the live desk.</span>
      <a href="/operator" className="font-semibold underline underline-offset-2 hover:text-primary-container">
        Unlock operator →
      </a>
    </p>
  );
}
