import Link from "next/link";

export const OPERATOR_REQUIRED = "Operator unlock required.";

/** A request error or note, with a way out when the server asked for the operator key. */
export function OperatorText({ text }: { text: string }) {
  if (text !== OPERATOR_REQUIRED) return <>{text}</>;
  return (
    <>
      This uses a real account or paid AI, so it needs the operator key.{" "}
      <Link href="/operator" className="font-semibold text-[var(--gold-soft,var(--primary))] underline underline-offset-2 hover:brightness-125">
        Unlock on the operator page
      </Link>
    </>
  );
}
